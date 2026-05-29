import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generatePromptPayQR } from "@/lib/promptpay";

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

  const bill = await db.bill.findUnique({ where: { id: billId }, include: { table: true } });
  if (!bill || bill.status !== "ACTIVE") {
    return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });
  }

  const validItems = items.filter((i) => i.menuItemId && i.qty > 0);
  const totalTHB = validItems.reduce((s, i) => s + i.unitPriceTHB * i.qty, 0);

  // Deferred (UNSET) bills are placed by the cashier — skip the accept step and
  // let them pick the payment method on the dashboard.
  const isDeferred = paymentMethod === "UNSET";

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
        method: paymentMethod,
        amountTHB: totalTHB,
        status: "PENDING",
        staffNote,
      },
    });
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
