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

  // Create or update pending payment — lock method to PROMPTPAY, amount = transfer leg.
  // The cash leg is held on the Payment and only becomes a SplitPayment (revenue) when
  // the payment is confirmed — so an abandoned scan never counts as cash received.
  const splitCash = cashPortion > 0 ? cashPortion : null;
  const existing = await db.payment.findUnique({ where: { orderId: order.id } });
  if (!existing) {
    await db.payment.create({
      data: { orderId: order.id, method: "PROMPTPAY", amountTHB: transferPortion, status: "PENDING", splitCashTHB: splitCash },
    });
  } else {
    await db.payment.update({
      where: { orderId: order.id },
      data: { method: "PROMPTPAY", amountTHB: transferPortion, splitCashTHB: splitCash },
    });
  }

  const qrDataUrl = await generatePromptPayQR(transferPortion);
  return NextResponse.json({ qrDataUrl, amountTHB: transferPortion, cashPortion });
}
