import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const order = await db.order.findUnique({ where: { id: Number(orderId) } });
  if (!order) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });

  const existing = await db.payment.findUnique({ where: { orderId: order.id } });
  if (existing) return NextResponse.json(existing);

  const payment = await db.payment.create({
    data: {
      orderId: order.id,
      method: "CASH",
      amountTHB: order.totalTHB,
      status: "PENDING",
    },
  });

  return NextResponse.json(payment);
}
