import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generatePromptPayQR } from "@/lib/promptpay";

export async function POST(req: NextRequest) {
  const { orderId, discountAmount } = await req.json() as { orderId: number; discountAmount?: number };
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const order = await db.order.findUnique({ where: { id: Number(orderId) } });
  if (!order) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });

  const finalAmount = Math.max(0, order.totalTHB - Math.min(discountAmount ?? 0, order.totalTHB));

  // Create or update pending payment — lock method to PROMPTPAY and apply discount
  const existing = await db.payment.findUnique({ where: { orderId: order.id } });
  if (!existing) {
    await db.payment.create({
      data: { orderId: order.id, method: "PROMPTPAY", amountTHB: finalAmount, status: "PENDING" },
    });
  } else {
    await db.payment.update({
      where: { orderId: order.id },
      data: { method: "PROMPTPAY", amountTHB: finalAmount },
    });
  }

  const qrDataUrl = await generatePromptPayQR(finalAmount);
  return NextResponse.json({ qrDataUrl, amountTHB: finalAmount });
}
