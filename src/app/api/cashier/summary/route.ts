import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

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

  const [payments, servedOrders, paidSessions, lastClose, pettyExpenses] = await Promise.all([
    db.payment.findMany({
      where: { status: "CONFIRMED", confirmedAt: { gte: start, lt: end } },
      include: { order: { select: { id: true, orderName: true, totalTHB: true } } },
      orderBy: { confirmedAt: "asc" },
    }),
    db.order.findMany({
      where: { status: "SERVED", createdAt: { gte: start, lt: end } },
      select: { id: true, totalTHB: true, orderName: true, createdAt: true },
    }),
    db.playerSession.findMany({
      where: { status: "PAID", updatedAt: { gte: start, lt: end } },
      select: { id: true, packageType: true, packagePrice: true, nickname: true },
    }),
    db.cashDrawerSession.findFirst({
      where: { date },
      orderBy: { createdAt: "desc" },
    }),
    db.cashExpense.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "asc" },
    }).catch(() => []),  // graceful fallback if table not migrated yet
  ]);

  const cashPayments = payments.filter((p) => p.method === "CASH");
  const transferPayments = payments.filter((p) => p.method !== "CASH");
  const cashTotal = cashPayments.reduce((s, p) => s + p.amountTHB, 0);
  const transferTotal = transferPayments.reduce((s, p) => s + p.amountTHB, 0);

  const ordersTotal = servedOrders.reduce((s, o) => s + o.totalTHB, 0);
  const gametimeTotal = paidSessions.reduce((s, s2) => s + s2.packagePrice, 0);

  const pettyTotal = pettyExpenses.filter((e) => e.type === "PETTY_CASH").reduce((s, e) => s + e.amount, 0);
  const advanceTotal = pettyExpenses.filter((e) => e.type === "STAFF_ADVANCE").reduce((s, e) => s + e.amount, 0);

  return NextResponse.json({
    date,
    cashTotal,
    transferTotal,
    grandTotal: cashTotal + transferTotal,
    cashPayments,
    transferPayments,
    ordersTotal,
    ordersCount: servedOrders.length,
    gametimeTotal,
    gametimeCount: paidSessions.length,
    lastClose,
    pettyExpenses,
    pettyTotal,
    advanceTotal,
  });
}
