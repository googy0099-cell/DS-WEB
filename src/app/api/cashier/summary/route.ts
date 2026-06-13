import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { computeRevenue } from "@/lib/revenue";

function getBangkokDateStr(): string {
  const now = new Date();
  const bkk = new Date(now.getTime() + 7 * 3600_000);
  return bkk.toISOString().slice(0, 10);
}

// Returns UTC bounds for a given Bangkok calendar day (YYYY-MM-DD)
function getDayBoundsForDate(bangkokDate: string): { start: Date; end: Date } {
  const [y, m, d] = bangkokDate.split("-").map(Number);
  // Bangkok midnight = UTC midnight − 7 hours
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 7 * 3600_000);
  const end = new Date(start.getTime() + 24 * 3600_000);
  return { start, end };
}

export async function GET(req: NextRequest) {
  const paramDate = req.nextUrl.searchParams.get("date");
  const date = (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) ? paramDate : getBangkokDateStr();
  const { start, end } = getDayBoundsForDate(date);

  const [rev, payments, splitPayments, paidSessionsCount, lastClose, pettyExpenses, topups] = await Promise.all([
    // Net revenue (confirmed payments; food/game split by item category — no double count)
    computeRevenue(date, date),
    // Payment detail lists for the drawer breakdown
    db.payment.findMany({
      where: { status: "CONFIRMED", confirmedAt: { gte: start, lt: end } },
      include: { order: { select: { id: true, orderName: true, status: true } } },
      orderBy: { confirmedAt: "asc" },
    }),
    // แบ่งจ่าย: cash legs shown in the cash list (totals already counted via computeRevenue)
    db.splitPayment.findMany({
      where: { confirmedAt: { gte: start, lt: end } },
      include: { order: { select: { id: true, orderName: true, status: true } } },
      orderBy: { confirmedAt: "asc" },
    }).catch(() => []),
    db.playerSession.count({ where: { status: "PAID", updatedAt: { gte: start, lt: end } } }),
    db.cashDrawerSession.findFirst({
      where: { date },
      orderBy: { createdAt: "desc" },
    }),
    db.cashExpense.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "asc" },
    }).catch(() => []),  // graceful fallback if table not migrated yet
    db.cashTopup.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "asc" },
    }).catch(() => []),  // graceful fallback if table not migrated yet
  ]);

  // Exclude payments tied to cancelled orders from the detail lists too
  const validPayments = payments.filter((p) => p.order?.status !== "CANCELLED");
  const transferPayments = validPayments.filter((p) => p.method !== "CASH");
  // Cash list = cash Payments + cash legs of split payments (shaped like a Payment for the UI)
  const splitCashEntries = splitPayments
    .filter((s) => s.order?.status !== "CANCELLED")
    .map((s) => ({
      id: -s.id, // negative id avoids clashing with real Payment ids in React keys
      method: "CASH",
      amountTHB: s.amountTHB,
      receivedAmount: null,
      changeAmount: null,
      slipUrl: null,
      confirmedAt: s.confirmedAt,
      staffNote: null,
      orderId: s.orderId,
      createdAt: s.createdAt,
      order: s.order ? { ...s.order, orderName: `${s.order.orderName} (แบ่งจ่าย-เงินสด)` } : s.order,
    }));
  const cashPayments = [...validPayments.filter((p) => p.method === "CASH"), ...splitCashEntries]
    .sort((a, b) => new Date(a.confirmedAt!).getTime() - new Date(b.confirmedAt!).getTime());

  const pettyTotal = pettyExpenses.filter((e) => e.type === "PETTY_CASH").reduce((s, e) => s + e.amount, 0);
  const advanceTotal = pettyExpenses.filter((e) => e.type === "STAFF_ADVANCE").reduce((s, e) => s + e.amount, 0);
  const topupTotal = topups.reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({
    date,
    cashTotal: rev.cashTotal,
    transferTotal: rev.transferTotal,
    grandTotal: rev.totalRevenue,
    cashPayments,
    transferPayments,
    ordersTotal: rev.foodRevenue,
    ordersCount: validPayments.length,
    gametimeTotal: rev.gametimeRevenue,
    gametimeCount: paidSessionsCount,
    lastClose,
    pettyExpenses,
    pettyTotal,
    advanceTotal,
    topups,
    topupTotal,
  });
}
