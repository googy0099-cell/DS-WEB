import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generatePromptPayQR } from "@/lib/promptpay";
import { sendPushToAll } from "@/lib/push-notify";
import { sendFcmNotify } from "@/lib/fcm-notify";

type LineItem = {
  menuItemId: number;
  nameTh: string;
  unitPriceTHB: number;
  qty: number;
  selectedSize?: string;
  selectedAddons?: string;
  selectedOptions?: string;
};

type PendingPlayer = {
  nameOrCode?: string;
  packageType: string;
  drinkName?: string;
  drinkPrice?: number;
  qty?: number;
};

type PendingExtra = {
  menuItemId: number;
  qty: number;
  unitPriceTHB: number;
  assignedPlayerIdx: number | null;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const billId = Number(id);
  const { paymentMethod, items, pendingPlayers, pendingExtras } = (await req.json()) as {
    paymentMethod: "CASH" | "PROMPTPAY" | "UNSET";
    items: LineItem[];
    pendingPlayers?: PendingPlayer[];
    pendingExtras?: PendingExtra[];
  };

  const bill = await db.bill.findUnique({ where: { id: billId }, select: { id: true, status: true, name: true, tableId: true, table: { select: { number: true } } } });
  if (!bill || bill.status !== "ACTIVE") {
    return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });
  }

  const validItems = items.filter((i) => i.menuItemId && i.qty > 0);
  const totalTHB = validItems.reduce((s, i) => s + i.unitPriceTHB * i.qty, 0);

  // UNSET = cashier deferred "pay at checkout" — stored as TAB so dashboard groups it with bill
  const isDeferred = paymentMethod === "UNSET";
  const storedMethod = isDeferred ? "TAB" : paymentMethod;

  const order = await db.order.create({
    data: {
      orderName: `บิล ${bill.name} — โต๊ะ ${bill.table.number}`,
      tableId: bill.tableId,
      billId,
      status: isDeferred ? "CONFIRMED" : "PENDING",
      totalTHB,
      items: {
        create: validItems.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.qty,
          unitPriceTHB: i.unitPriceTHB,
          selectedSize: i.selectedSize ?? null,
          selectedAddons: i.selectedAddons ?? null,
          selectedOptions: i.selectedOptions ?? null,
        })),
      },
    },
  });

  // Store pending player data in staffNote — cashier creates sessions after confirming
  const staffNote = pendingPlayers?.length
    ? JSON.stringify({ billId, tableId: bill.tableId, players: pendingPlayers, extraItems: pendingExtras ?? [] })
    : null;

  if (paymentMethod === "CASH" || paymentMethod === "UNSET" || (paymentMethod === "PROMPTPAY" && pendingPlayers?.length)) {
    await db.payment.create({
      data: {
        orderId: order.id,
        method: storedMethod,
        amountTHB: totalTHB,
        status: "PENDING",
        staffNote,
      },
    });
  }

  // Deferred (TAB) orders เข้าครัวเลย — ปลุก staff ผ่าน push/FCM. Telegram แจ้งตอนปิดแท็บ (จ่ายแล้ว)
  if (isDeferred && totalTHB > 0) {
    await Promise.allSettled([
      sendPushToAll("🔔 ออเดอร์ใหม่!", `ตี้ ${bill.name} · ฿${totalTHB}`),
      sendFcmNotify("🔔 ออเดอร์ใหม่!", `ตี้ ${bill.name} · ฿${totalTHB}`),
    ]);
  }

  const config = await db.paymentConfig.findUnique({ where: { id: 1 } });
  const promptPayId = config?.promptPayId ?? process.env.PROMPTPAY_ID ?? "";
  const qrDataUrl =
    paymentMethod === "PROMPTPAY" && totalTHB > 0 && promptPayId
      ? await generatePromptPayQR(totalTHB, promptPayId)
      : null;

  return NextResponse.json({
    orderId: order.id,
    totalTHB,
    qrDataUrl,
    accountName: config?.accountName ?? "",
    bankName: config?.bankName ?? "",
  });
}
