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

  const payments = await db.payment.findMany({
    where: {
      status: "CONFIRMED",
      confirmedAt: { gte: start, lt: end },
    },
    include: { order: { select: { id: true, orderName: true, totalTHB: true } } },
    orderBy: { confirmedAt: "asc" },
  });

  const cashPayments = payments.filter((p) => p.method === "CASH");
  const transferPayments = payments.filter((p) => p.method !== "CASH");

  const cashTotal = cashPayments.reduce((s, p) => s + p.amountTHB, 0);
  const transferTotal = transferPayments.reduce((s, p) => s + p.amountTHB, 0);

  const lastClose = await db.cashDrawerSession.findFirst({
    where: { date },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    date,
    cashTotal,
    transferTotal,
    cashPayments,
    transferPayments,
    lastClose,
  });
}
