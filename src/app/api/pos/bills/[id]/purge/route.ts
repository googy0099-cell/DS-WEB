import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const billId = Number(id);

    const bill = await db.bill.findUnique({ where: { id: billId }, select: { id: true, name: true } });
    if (!bill) return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });

    const orders = await db.order.findMany({ where: { billId }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);

    // Delete in dependency order: child records first
    if (orderIds.length > 0) {
      await db.receipt.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.order.deleteMany({ where: { billId } });
    }
    await db.playerSession.deleteMany({ where: { billId } });
    await db.bill.delete({ where: { id: billId } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DELETE /api/pos/bills/purge]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
