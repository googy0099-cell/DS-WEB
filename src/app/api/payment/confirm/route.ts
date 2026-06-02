import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { createSessionsFromStaffNote } from "@/lib/pending-sessions";

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
    select: { orderId: true, amountTHB: true, staffNote: true, method: true },
  });

  const existingOrder = await db.order.findUnique({
    where: { id: payment.orderId },
    select: {
      kitchenServedAt: true,
      userId: true,
      totalTHB: true,
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

  // Award loyalty + dice points at payment time
  if (userId) {
    const pts = Math.floor(payment.amountTHB / 10);
    await db.user.update({
      where: { id: Number(userId) },
      data: { points: { increment: pts }, totalSpentTHB: { increment: payment.amountTHB } },
    });
  }
  if (existingOrder?.userId) {
    const dice = Math.floor((existingOrder.totalTHB ?? 0) / 49);
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
        totalTHB: existingOrder.totalTHB,
        paymentMethod: payment.method,
        locationLabel,
        itemsJson: JSON.stringify(existingOrder.items),
        confirmedAt,
      },
      update: {},
    });
  }

  return NextResponse.json({ ...payment, orderId: payment.orderId });
}
