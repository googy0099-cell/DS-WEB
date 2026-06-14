import { NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

// Wipe ALL test-mode data. Deletes every isTest=true row across the tagged tables
// plus the non-tagged children of test orders (OrderItem), in FK-safe order.
// Passing isTest:true explicitly overrides the extension's current-mode filter,
// so this works whether or not the caller is currently in test mode.
export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "เฉพาะเจ้าของร้าน" }, { status: 403 });
  }

  const testOrders = await db.order.findMany({ where: { isTest: true }, select: { id: true } });
  const orderIds = testOrders.map((o) => o.id);

  const deleted: Record<string, number> = {};
  const del = async (name: string, n: Promise<{ count: number }>) => { deleted[name] = (await n).count; };

  // children of test orders first (OrderItem is not tagged → delete by orderId)
  if (orderIds.length > 0) {
    await del("orderItems", db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }));
  } else {
    deleted.orderItems = 0;
  }
  await del("receipts", db.receipt.deleteMany({ where: { isTest: true } }));
  await del("splitPayments", db.splitPayment.deleteMany({ where: { isTest: true } }));
  await del("payments", db.payment.deleteMany({ where: { isTest: true } }));
  await del("orders", db.order.deleteMany({ where: { isTest: true } }));
  await del("playerSessions", db.playerSession.deleteMany({ where: { isTest: true } }));
  await del("bills", db.bill.deleteMany({ where: { isTest: true } }));
  await del("cashExpenses", db.cashExpense.deleteMany({ where: { isTest: true } }));
  await del("cashTopups", db.cashTopup.deleteMany({ where: { isTest: true } }));
  await del("drawerSessions", db.cashDrawerSession.deleteMany({ where: { isTest: true } }));

  // HR transactional (Phase 2). Checklist items reference checklists → delete first.
  await del("hrChecklistItems", db.hrChecklistItem.deleteMany({ where: { isTest: true } }));
  await del("hrChecklists", db.hrChecklist.deleteMany({ where: { isTest: true } }));
  await del("hrAttendance", db.hrAttendance.deleteMany({ where: { isTest: true } }));
  await del("hrDeductions", db.hrDeduction.deleteMany({ where: { isTest: true } }));
  await del("hrTasks", db.hrTask.deleteMany({ where: { isTest: true } }));
  await del("hrKpis", db.hrKpi.deleteMany({ where: { isTest: true } }));
  await del("hrPaymentEvents", db.hrPaymentEvent.deleteMany({ where: { isTest: true } }));

  const total = Object.values(deleted).reduce((s, n) => s + n, 0);
  return NextResponse.json({ ok: true, total, deleted });
}
