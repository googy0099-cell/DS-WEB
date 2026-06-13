import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { notifyShopClose } from "@/lib/telegram-notify";

function getBangkokDateStr(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

// UTC bounds for a given Bangkok calendar day (YYYY-MM-DD) — matches /api/cashier/summary
function getDayBoundsForDate(bangkokDate: string): { start: Date; end: Date } {
  const [y, m, d] = bangkokDate.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 7 * 3600_000);
  const end = new Date(start.getTime() + 24 * 3600_000);
  return { start, end };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const closedById = session?.user?.id ? Number(session.user.id) : undefined;

  const { openingFloat, countedCash, note, date: bodyDate } = (await req.json()) as {
    openingFloat: number;
    countedCash: number;
    note?: string;
    date?: string; // shift's Bangkok date — set when the shift crossed midnight
  };

  // Close against the shift's own day (not "today") so a shift opened yesterday
  // reconciles against yesterday's sales — same date the summary screen showed.
  const date = (bodyDate && /^\d{4}-\d{2}-\d{2}$/.test(bodyDate)) ? bodyDate : getBangkokDateStr();
  const { start, end } = getDayBoundsForDate(date);

  const [allPayments, allSplits, expenses, topups] = await Promise.all([
    db.payment.findMany({
      where: { status: "CONFIRMED", confirmedAt: { gte: start, lt: end } },
      select: { method: true, amountTHB: true, order: { select: { status: true } } },
    }),
    db.splitPayment.findMany({
      where: { confirmedAt: { gte: start, lt: end } },
      select: { amountTHB: true, order: { select: { status: true } } },
    }).catch(() => []),
    db.cashExpense.findMany({ where: { type: "PETTY_CASH", createdAt: { gte: start, lt: end } } }),
    db.cashTopup.findMany({ where: { createdAt: { gte: start, lt: end } } }).catch(() => []),
  ]);

  // Exclude payments tied to cancelled orders (matches /api/cashier/summary)
  const payments = allPayments.filter((p) => p.order?.status !== "CANCELLED");
  const splits = allSplits.filter((s) => !s.order || s.order.status !== "CANCELLED");

  // แบ่งจ่าย: cash legs of split payments are real cash in the drawer
  const splitCash = splits.reduce((s, x) => s + x.amountTHB, 0);
  const cashSales = payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amountTHB, 0) + splitCash;
  const totalTransfer = payments.filter((p) => p.method !== "CASH").reduce((s, p) => s + p.amountTHB, 0);
  const pettyTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const topupTotal = topups.reduce((s, t) => s + t.amount, 0);
  // เงินที่ควรมีในเก๊ะ = ขายเงินสด − รายจ่ายเก๊ะ + เงินเติมเข้าเก๊ะ
  const expectedCash = cashSales - pettyTotal + topupTotal;
  const difference = countedCash - (openingFloat + expectedCash);
  const grandTotal = cashSales + totalTransfer;

  const expenseNote = expenses.length > 0
    ? `รายจ่ายเก๊ะ: ${expenses.map((e) => `${e.description} ฿${e.amount}`).join(", ")} (รวม ฿${pettyTotal})`
    : null;
  const topupNote = topups.length > 0
    ? `เติมเงินเข้าเก๊ะ: ${topups.map((t) => `${t.description} ฿${t.amount}`).join(", ")} (รวม ฿${topupTotal})`
    : null;
  const fullNote = [note, expenseNote, topupNote].filter(Boolean).join(" | ") || null;

  const record = await db.cashDrawerSession.create({
    data: {
      date,
      openingFloat,
      expectedCash,
      totalTransfer,
      countedCash,
      difference,
      note: fullNote,
      ...(closedById ? { closedById } : {}),
    },
  });

  notifyShopClose({ cashTotal: cashSales, transferTotal: totalTransfer, grandTotal, difference, pettyExpenses: pettyTotal }).catch(() => {});

  return NextResponse.json({ ...record, pettyTotal, topupTotal, grandTotal });
}
