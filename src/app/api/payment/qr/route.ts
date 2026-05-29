import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generatePromptPayQR } from "@/lib/promptpay";

export async function POST(req: NextRequest) {
  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const order = await db.order.findUnique({ where: { id: Number(orderId) } });
  if (!order) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });

  // Create or return existing pending payment — lock method to PROMPTPAY
  const existing = await db.payment.findUnique({ where: { orderId: order.id } });
  if (!existing) {
    await db.payment.create({
      data: {
        orderId: order.id,
        method: "PROMPTPAY",
        amountTHB: order.totalTHB,
        status: "PENDING",
      },
    });
  } else if (existing.method !== "PROMPTPAY") {
    await db.payment.update({ where: { orderId: order.id }, data: { method: "PROMPTPAY" } });
  }

  const qrDataUrl = await generatePromptPayQR(order.totalTHB);
  return NextResponse.json({ qrDataUrl, amountTHB: order.totalTHB });
}
