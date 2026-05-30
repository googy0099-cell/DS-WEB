import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendTelegramNotify } from "@/lib/telegram-notify";
import { sendPushToAll } from "@/lib/push-notify";
import { sendFcmNotify } from "@/lib/fcm-notify";
import { formatThaiTime } from "@/lib/thai-datetime";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let whereClause: Record<string, unknown> = {};
  if (status === "active") {
    whereClause = { status: { in: ["PENDING", "CONFIRMED", "PAID"] } };
  } else if (status === "today") {
    whereClause = {
      status: { in: ["SERVED", "CANCELLED"] },
      createdAt: { gte: today, lt: tomorrow },
    };
  } else if (status) {
    whereClause = { status };
  } else {
    whereClause = { status: { in: ["PENDING", "CONFIRMED", "PAID"] } };
  }

  const orders = await db.order.findMany({
    where: whereClause,
    include: { items: { include: { menuItem: true } }, user: true, payment: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(orders);
}

function getBangkokHHMM(): string {
  const now = new Date();
  const bkk = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60_000);
  return `${String(bkk.getHours()).padStart(2, "0")}:${String(bkk.getMinutes()).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orderName, userId, items, note, source, billId } = body as {
    orderName: string;
    userId?: number | null;
    billId?: number | null;
    items: {
      menuItemId: number;
      quantity: number;
      selectedSize?: string | null;
      selectedAddons?: { id: number; groupId: number; nameTh: string; priceTHB: number }[];
      selectedOptions?: { groupId: number; groupName: string; choiceId: number; choiceName: string; priceTHB: number }[];
    }[];
    note?: string;
    source?: "cashier";
  };
  const isCashier = source === "cashier";

  if (!orderName?.trim() || !items?.length) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const finalName = orderName.trim();

  // ถ้ามีออเดอร์ที่ยังไม่ชำระของคนนี้วันนี้ → เพิ่มรายการเข้าออเดอร์เดิม
  const unpaidWhere = userId
    ? { userId, createdAt: { gte: today, lt: tomorrow }, status: { in: ["PENDING", "CONFIRMED"] }, payment: { is: null } }
    : { orderName: finalName, createdAt: { gte: today, lt: tomorrow }, status: { in: ["PENDING", "CONFIRMED"] }, payment: { is: null } };

  // Cashier orders are discrete transactions — never merge into an existing order
  const existingUnpaid = isCashier
    ? null
    : await db.order.findFirst({
        where: unpaidWhere,
        include: { items: { include: { menuItem: true } } },
      });

  const menuItems = await db.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) } },
  });

  // Block items outside their selling hours
  const nowHHMM = getBangkokHHMM();
  const blocked = menuItems.filter((m) => {
    if (!m.sellStartTime || !m.sellEndTime) return false;
    return nowHHMM < m.sellStartTime || nowHHMM > m.sellEndTime;
  });
  if (blocked.length > 0) {
    return NextResponse.json(
      { error: `ไม่สามารถสั่งได้ตอนนี้: ${blocked.map((m) => m.nameTh).join(", ")} — รับออเดอร์ ${blocked[0].sellStartTime}–${blocked[0].sellEndTime} น. เท่านั้น` },
      { status: 400 }
    );
  }

  const itemsWithPrice = items.map((item) => {
    const menu = menuItems.find((m) => m.id === item.menuItemId)!;
    let basePrice = menu.priceTHB;
    if (item.selectedSize === "S" && menu.priceS) basePrice = menu.priceS;
    if (item.selectedSize === "XL" && menu.priceXL) basePrice = menu.priceXL;
    const addonTotal = (item.selectedAddons ?? []).reduce((s, a) => s + a.priceTHB, 0);
    const optionTotal = (item.selectedOptions ?? []).reduce((s, o) => s + o.priceTHB, 0);
    return {
      ...item,
      unitPriceTHB: basePrice + addonTotal + optionTotal,
      nameTh: menu.nameTh,
    };
  });

  const newTotal = itemsWithPrice.reduce((sum, i) => sum + i.unitPriceTHB * i.quantity, 0);

  // ถ้ามีออเดอร์เดิมที่ยังไม่ชำระ → เพิ่มรายการเข้าไป
  if (existingUnpaid) {
    await db.orderItem.createMany({
      data: itemsWithPrice.map((i) => ({
        orderId: existingUnpaid.id,
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        unitPriceTHB: i.unitPriceTHB,
        selectedSize: i.selectedSize ?? null,
        selectedAddons: i.selectedAddons?.length ? JSON.stringify(i.selectedAddons) : null,
        selectedOptions: i.selectedOptions?.length ? JSON.stringify(i.selectedOptions) : null,
      })),
    });
    const updatedOrder = await db.order.update({
      where: { id: existingUnpaid.id },
      data: { totalTHB: existingUnpaid.totalTHB + newTotal, note: note || existingUnpaid.note },
      include: { items: { include: { menuItem: true } } },
    });
    return NextResponse.json(updatedOrder, { status: 200 });
  }

  const totalTHB = newTotal;

  // Resolve tableId from bill if provided
  let resolvedTableId: number | null = null;
  if (billId) {
    const bill = await db.bill.findUnique({ where: { id: billId, status: "ACTIVE" }, select: { tableId: true } });
    resolvedTableId = bill?.tableId ?? null;
  }

  // Auto-link to the member's active PlayerSession in this bill
  let resolvedPlayerSessionId: number | null = null;
  if (billId && userId) {
    const ps = await db.playerSession.findFirst({
      where: { billId, userId, status: "ACTIVE" },
      select: { id: true },
    });
    resolvedPlayerSessionId = ps?.id ?? null;
  }

  const order = await db.order.create({
    data: {
      orderName: finalName,
      userId: userId ?? null,
      billId: billId ?? null,
      tableId: resolvedTableId,
      playerSessionId: resolvedPlayerSessionId,
      totalTHB,
      note: note || null,
      status: isCashier ? "CONFIRMED" : "PENDING",
      items: {
        create: itemsWithPrice.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          unitPriceTHB: i.unitPriceTHB,
          selectedSize: i.selectedSize ?? null,
          selectedAddons: i.selectedAddons?.length ? JSON.stringify(i.selectedAddons) : null,
          selectedOptions: i.selectedOptions?.length ? JSON.stringify(i.selectedOptions) : null,
        })),
      },
    },
    include: { items: { include: { menuItem: true } } },
  });

  // Cashier-initiated orders skip payment-method selection at order time —
  // create an UNSET payment so the dashboard shows the [เงินสด|สแกน] picker.
  if (isCashier) {
    await db.payment.create({
      data: { orderId: order.id, method: "UNSET", amountTHB: totalTHB, status: "PENDING" },
    });
  }

  const itemLines = itemsWithPrice
    .map((i) => {
      const sizePart = i.selectedSize ? ` (${i.selectedSize})` : "";
      const addonPart = i.selectedAddons?.length
        ? " + " + i.selectedAddons.map((a) => a.nameTh).join(", ")
        : "";
      const optionPart = i.selectedOptions?.length
        ? " [" + i.selectedOptions.map((o) => `${o.groupName}: ${o.choiceName}`).join(", ") + "]"
        : "";
      return `  • ${i.nameTh}${sizePart}${addonPart}${optionPart} x${i.quantity} = ฿${i.unitPriceTHB * i.quantity}`;
    })
    .join("\n");

  if (!isCashier) {
    const billTag = billId ? ` [ตี้ ${(await db.bill.findUnique({ where: { id: billId }, select: { name: true } }))?.name ?? ""}]` : "";
    const lineMsg = `\n🔔 ออเดอร์ใหม่! 👤 ${finalName}${billTag}\n${itemLines}\n💰 รวม ฿${totalTHB}${note ? `\n📝 หมายเหตุ: ${note}` : ""}\n🕐 ${formatThaiTime(order.createdAt)}`;
    await Promise.allSettled([
      sendTelegramNotify(lineMsg),
      sendPushToAll("🔔 ออเดอร์ใหม่!", `${finalName} • ฿${totalTHB}`),
      sendFcmNotify("🔔 ออเดอร์ใหม่!", `${finalName} • ฿${totalTHB}`),
    ]);
  }

  return NextResponse.json(order, { status: 201 });
}
