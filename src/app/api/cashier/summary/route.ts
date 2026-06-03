import { NextResponse } from "next/server";
import db from "@/lib/db";

function getBangkokDateStr(): string {
  const now = new Date();
  const bkk = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60_000);
  return `${bkk.getFullYear()}-${String(bkk.getMonth() + 1).padStart(2, "0")}-${String(bkk.getDate()).padStart(2, "0")}`;
}

function getBangkokDayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const offsetMs = (7 * 60 + now.getTimezoneOffset()) * 60_000;
  const bkkNow = new Date(now.getTime() + offsetMs);
  const startBkk = new Date(bkkNow);
  startBkk.setHours(0, 0, 0, 0);
  const endBkk = new Date(startBkk);
  endBkk.setDate(endBkk.getDate() + 1);
  return {
    start: new Date(startBkk.getTime() - offsetMs),
    end: new Date(endBkk.getTime() - offsetMs),
  };
}

export async function GET() {
  const date = getBangkokDateStr();
  const { start, end } = getBangkokDayBounds();

  const [payments, servedOrders, paidSessions, lastClose, pettyExpenses] = await Promise.all([
    db.payment.findMany({
      where: { status: "CONFIRMED", confirmedAt: { gte: start, lt: end } },
      include: { order: { select: { id: true, orderName: true, totalTHB: true } } },
      orderBy: { confirmedAt: "asc" },
    }),
    // All SERVED orders today (food/drinks)
    db.order.findMany({
      where: { status: "SERVED", createdAt: { gte: start, lt: end } },
      select: { id: true, totalTHB: true, orderName: true, createdAt: true },
    }),
    // PAID player sessions today (gametime revenue)
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
    }),
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
