import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendTelegramNotify } from "@/lib/telegram-notify";
import { sendExpoPush } from "@/lib/expo-push-notify";

export async function PATCH(req: NextRequest) {
  const { paymentId, userId } = await req.json();

  const payment = await db.payment.update({
    where: { id: Number(paymentId) },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
    include: { order: true },
  });

  await db.order.update({
    where: { id: payment.orderId },
    data: { status: "SERVED" },
  });

  // Award points: 1 point per 10 THB
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

  await Promise.allSettled([
    sendTelegramNotify(`💸 ได้รับเงินแล้ว (พร้อมเพย์)\nชื่อ: ${payment.order.orderName} | ฿${payment.amountTHB}\nออเดอร์ #${payment.orderId}`),
    sendExpoPush("💸 ได้รับเงินแล้ว!", `${payment.order.orderName} • ฿${payment.amountTHB}`),
  ]);

  return NextResponse.json(payment);
}
