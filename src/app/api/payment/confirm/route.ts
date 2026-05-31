import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createSessionsFromStaffNote } from "@/lib/pending-sessions";

export async function PATCH(req: NextRequest) {
  const { paymentId, userId, receivedAmount, changeAmount } = await req.json();

  const payment = await db.payment.update({
    where: { id: Number(paymentId) },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      ...(receivedAmount != null ? { receivedAmount, changeAmount: changeAmount ?? 0 } : {}),
    },
    select: { orderId: true, amountTHB: true, staffNote: true },
  });

  // Only mark SERVED if kitchen has already finished; otherwise PAID (waiting for kitchen)
  const existingOrder = await db.order.findUnique({
    where: { id: payment.orderId },
    select: { kitchenServedAt: true, userId: true, totalTHB: true },
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

  return NextResponse.json(payment);
}
