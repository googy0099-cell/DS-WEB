import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { createSessionsFromStaffNote } from "@/lib/pending-sessions";
import { notifyOrderPaid } from "@/lib/telegram-notify";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paymentId, userId, receivedAmount, changeAmount } = await req.json();

  const confirmedAt = new Date();

  const payment = await db.payment.update({
    where: { id: Number(paymentId) },
    data: {
      status: "CONFIRMED",
      confirmedAt,
      ...(receivedAmount != null ? { receivedAmount, changeAmount: changeAmount ?? 0 } : {}),
    },
    select: { orderId: true, amountTHB: true, staffNote: true, method: true, splitCashTHB: true },
  });

  // แบ่งจ่าย: now that payment is confirmed, record the cash leg as revenue
  // (idempotent — one split row per order even if confirm runs twice)
  if (payment.splitCashTHB && payment.splitCashTHB > 0) {
    const ord = await db.order.findUnique({ where: { id: payment.orderId }, select: { billId: true } });
    await db.splitPayment.deleteMany({ where: { orderId: payment.orderId } });
    await db.splitPayment.create({
      data: { orderId: payment.orderId, billId: ord?.billId ?? null, amountTHB: payment.splitCashTHB, confirmedAt },
    });
  }

  const existingOrder = await db.order.findUnique({
    where: { id: payment.orderId },
    select: {
      kitchenServedAt: true,
      userId: true,
      totalTHB: true,
      discountAmount: true,
      orderName: true,
      tableId: true,
      bill: { select: { name: true, table: { select: { number: true } } } },
      items: {
        select: {
          quantity: true,
          unitPriceTHB: true,
          selectedSize: true,
          selectedAddons: true,
          selectedOptions: true,
          menuItem: { select: { nameTh: true } },
        },
      },
    },
  });

  const newStatus = existingOrder?.kitchenServedAt ? "SERVED" : "PAID";

  await db.order.update({
    where: { id: payment.orderId },
    data: { status: newStatus },
  });

  // For a split payment the money actually received = transfer leg + cash leg
  const paidTotal = payment.amountTHB + (payment.splitCashTHB ?? 0);
  const isSplit = (payment.splitCashTHB ?? 0) > 0;

  // Award loyalty + dice points at payment time (on the full amount paid)
  if (userId) {
    const pts = Math.floor(paidTotal / 10);
    await db.user.update({
      where: { id: Number(userId) },
      data: { points: { increment: pts }, totalSpentTHB: { increment: paidTotal } },
    });
  }
  if (existingOrder?.userId) {
    const dice = Math.floor(paidTotal / 49);
    if (dice > 0) {
      await db.user.update({ where: { id: existingOrder.userId }, data: { dicePoints: { increment: dice } } });
    }
  }

  await createSessionsFromStaffNote(payment.staffNote);

  // Auto-save digital receipt snapshot
  if (existingOrder) {
    const locationLabel = existingOrder.bill
      ? `${existingOrder.bill.name} · โต๊ะ ${existingOrder.bill.table.number}`
      : existingOrder.tableId ? `โต๊ะ ${existingOrder.tableId}` : "-";

    await db.receipt.upsert({
      where: { orderId: payment.orderId },
      create: {
        orderId: payment.orderId,
        orderName: existingOrder.orderName ?? "",
        totalTHB: paidTotal,
        discountAmount: existingOrder.discountAmount ?? null,
        paymentMethod: isSplit ? "SPLIT" : payment.method,
        locationLabel,
        itemsJson: JSON.stringify(existingOrder.items),
        confirmedAt,
      },
      update: {},
    });
  }

  // Notify the ORDER room — only on confirmed payment (= money actually received).
  // TAB orders are notified once at tab-checkout instead, to avoid one msg per pending item.
  if (existingOrder && payment.method !== "TAB") {
    const itemLines = existingOrder.items
      .map((i) => `  • ${i.menuItem.nameTh} x${i.quantity} = ฿${(i.unitPriceTHB * i.quantity).toLocaleString("th-TH")}`)
      .join("\n");
    const location = existingOrder.bill
      ? `${existingOrder.bill.name} · โต๊ะ ${existingOrder.bill.table.number}`
      : existingOrder.tableId ? `โต๊ะ ${existingOrder.tableId}` : "";
    notifyOrderPaid({
      orderLabel: existingOrder.orderName || `ออเดอร์ #${payment.orderId}`,
      location,
      itemLines,
      netTotal: paidTotal,
      method: isSplit ? "SPLIT" : payment.method,
    }).catch(() => {});
  }

  return NextResponse.json({ ...payment, orderId: payment.orderId });
}
