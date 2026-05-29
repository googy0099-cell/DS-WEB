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
  });

  const order = await db.order.update({
    where: { id: payment.orderId },
    data: { status: "SERVED" },
    select: { orderName: true, userId: true, totalTHB: true },
  });

  // Award loyalty points (1 per 10 THB) on cashier confirmation
  if (userId) {
    const pts = Math.floor(payment.amountTHB / 10);
    await db.user.update({
      where: { id: Number(userId) },
      data: {
        points: { increment: pts },
        totalSpentTHB: { increment: payment.amountTHB },
      },
    });
  }

  if (order.userId) {
    const diceEarned = Math.floor(order.totalTHB / 49);
    if (diceEarned > 0) {
      await db.user.update({ where: { id: order.userId }, data: { dicePoints: { increment: diceEarned } } });
    }
  }

  // If staffNote contains pending player data, create sessions now
  await createSessionsFromStaffNote(payment.staffNote);


  return NextResponse.json(payment);
}
