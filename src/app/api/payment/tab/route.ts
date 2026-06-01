import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const order = await db.order.findUnique({
    where: { id: Number(orderId) },
    select: { id: true, totalTHB: true, billId: true, status: true, handledById: true, payment: { select: { id: true, method: true } } },
  });
  if (!order) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
  if (!order.billId) return NextResponse.json({ error: "ออเดอร์นี้ไม่ได้เชื่อมกับตี้" }, { status: 400 });

  // Cashier counter flow: order already exists with an UNSET payment placeholder.
  // Convert it to TAB in place so the dashboard groups it with the bill card.
  if (order.payment) {
    if (order.payment.method !== "UNSET" && order.payment.method !== "TAB") {
      return NextResponse.json({ error: "มีการชำระเงินอยู่แล้ว" }, { status: 400 });
    }
    const payment = await db.payment.update({
      where: { id: order.payment.id },
      data: { method: "TAB", amountTHB: order.totalTHB, status: "PENDING" },
    });
    return NextResponse.json(payment);
  }

  // Customer flow: no payment yet — create TAB and keep PENDING so staff accepts it
  const [payment] = await db.$transaction([
    db.payment.create({
      data: { orderId: order.id, method: "TAB", amountTHB: order.totalTHB, status: "PENDING" },
    }),
    db.order.update({ where: { id: order.id }, data: { status: "PENDING" } }),
  ]);

  return NextResponse.json(payment);
}
