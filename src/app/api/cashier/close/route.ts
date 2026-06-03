import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { notifyShopClose } from "@/lib/telegram-notify";

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

export async function POST(req: NextRequest) {
  const session = await auth();
  const closedById = session?.user?.id ? Number(session.user.id) : undefined;

  const { openingFloat, countedCash, note } = (await req.json()) as {
    openingFloat: number;
    countedCash: number;
    note?: string;
  };

  const date = getBangkokDateStr();
  const { start, end } = getBangkokDayBounds();

  const [payments, expenses] = await Promise.all([
    db.payment.findMany({ where: { status: "CONFIRMED", confirmedAt: { gte: start, lt: end } } }),
    db.cashExpense.findMany({ where: { type: "PETTY_CASH", createdAt: { gte: start, lt: end } } }),
  ]);

  const cashSales = payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amountTHB, 0);
  const totalTransfer = payments.filter((p) => p.method !== "CASH").reduce((s, p) => s + p.amountTHB, 0);
  const pettyTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const expectedCash = cashSales - pettyTotal;
  const difference = countedCash - (openingFloat + expectedCash);
  const grandTotal = cashSales + totalTransfer;

  const expenseNote = expenses.length > 0
    ? `รายจ่ายเก๊ะ: ${expenses.map((e) => `${e.description} ฿${e.amount}`).join(", ")} (รวม ฿${pettyTotal})`
    : null;
  const fullNote = [note, expenseNote].filter(Boolean).join(" | ") || null;

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

  return NextResponse.json({ ...record, pettyTotal, grandTotal });
}
