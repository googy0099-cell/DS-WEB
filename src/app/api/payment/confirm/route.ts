import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendTelegramNotify } from "@/lib/telegram-notify";
import { sendFcmNotify } from "@/lib/fcm-notify";

export async function PATCH(req: NextRequest) {
  const { paymentId, userId, receivedAmount, changeAmount } = await req.json();

  const payment = await db.payment.update({
    where: { id: Number(paymentId) },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      ...(receivedAmount != null ? { receivedAmount, changeAmount: changeAmount ?? 0 } : {}),
    },
    include: { order: { select: { orderName: true, userId: true, totalTHB: true } } },
  });

  await db.order.update({
    where: { id: payment.orderId },
    data: { status: "SERVED" },
  });

  // Award loyalty points (1 per 10 THB) and dice points (1 per 49 THB) on cashier confirmation
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

  const orderUserId = payment.order.userId;
  if (orderUserId) {
    const diceEarned = Math.floor(payment.order.totalTHB / 49);
    if (diceEarned > 0) {
      await db.user.update({ where: { id: orderUserId }, data: { dicePoints: { increment: diceEarned } } });
    }
  }

  await Promise.allSettled([
    sendTelegramNotify(`💸 ได้รับเงินแล้ว (พร้อมเพย์)\nชื่อ: ${payment.order.orderName} | ฿${payment.amountTHB}\nออเดอร์ #${payment.orderId}`),
    sendFcmNotify("💸 ได้รับเงินแล้ว!", `${payment.order.orderName} • ฿${payment.amountTHB}`),
  ]);

  return NextResponse.json(payment);
}
