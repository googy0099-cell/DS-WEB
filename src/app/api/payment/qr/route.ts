import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generatePromptPayQR } from "@/lib/promptpay";

export async function POST(req: NextRequest) {
  const { orderId, discountAmount, splitCashTHB } = await req.json() as { orderId: number; discountAmount?: number; splitCashTHB?: number };
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const order = await db.order.findUnique({ where: { id: Number(orderId) } });
  if (!order) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });

  const disc = Math.min(discountAmount ?? 0, order.totalTHB);
  const finalAmount = Math.max(0, order.totalTHB - disc);

  // แบ่งจ่าย: cash portion is recorded separately; only the remainder is scanned (transfer)
  const cashPortion = Math.max(0, Math.min(Math.round(splitCashTHB ?? 0), finalAmount));
  const transferPortion = finalAmount - cashPortion;

  // Persist the discount on the order so receipts/queue can show it consistently
  await db.order.update({ where: { id: order.id }, data: { discountAmount: disc > 0 ? disc : null } });

  // Create or update pending payment — lock method to PROMPTPAY, amount = transfer leg
  const existing = await db.payment.findUnique({ where: { orderId: order.id } });
  if (!existing) {
    await db.payment.create({
      data: { orderId: order.id, method: "PROMPTPAY", amountTHB: transferPortion, status: "PENDING" },
    });
  } else {
    await db.payment.update({
      where: { orderId: order.id },
      data: { method: "PROMPTPAY", amountTHB: transferPortion },
    });
  }

  // Record/refresh the cash leg (idempotent: one split row per order even if QR is regenerated)
  await db.splitPayment.deleteMany({ where: { orderId: order.id } });
  if (cashPortion > 0) {
    await db.splitPayment.create({
      data: { orderId: order.id, billId: order.billId, amountTHB: cashPortion, confirmedAt: new Date() },
    });
  }

  const qrDataUrl = await generatePromptPayQR(transferPortion);
  return NextResponse.json({ qrDataUrl, amountTHB: transferPortion, cashPortion });
}
