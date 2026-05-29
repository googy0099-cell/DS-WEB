import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

function parseDateRange(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  // Bangkok midnight → UTC (BKK = UTC+7, so BKK 00:00 = UTC -7h = prev day 17:00)
  const start = new Date(Date.UTC(fy, fm - 1, fd, -7, 0, 0));
  const end = new Date(Date.UTC(ty, tm - 1, td + 1, -7, 0, 0));
  return { start, end };
}

function bkkDateKey(utcDate: Date): string {
  const bkk = new Date(utcDate.getTime() + 7 * 3600_000);
  return bkk.toISOString().slice(0, 10);
}

function fillDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const from = searchParams.get("from") || today;
  const to = searchParams.get("to") || today;

  const { start, end } = parseDateRange(from, to);
  const periodMs = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - periodMs);
  const prevEnd = start;

  const [orders, prevAgg] = await Promise.all([
    db.order.findMany({
      where: { status: { in: ["SERVED", "CANCELLED"] }, createdAt: { gte: start, lt: end } },
      select: { id: true, totalTHB: true, status: true, createdAt: true },
    }),
    db.order.aggregate({
      where: { status: "SERVED", createdAt: { gte: prevStart, lt: prevEnd } },
      _sum: { totalTHB: true },
    }),
  ]);

  const served = orders.filter((o) => o.status === "SERVED");
  const cancelled = orders.filter((o) => o.status === "CANCELLED");

  const totalSales = served.reduce((s, o) => s + o.totalTHB, 0);
  const totalBills = served.length;
  const avgBasket = totalBills > 0 ? Math.round(totalSales / totalBills) : 0;
  const voidAmount = cancelled.reduce((s, o) => s + o.totalTHB, 0);
  const prevSales = prevAgg._sum.totalTHB ?? 0;
  const pctChange = prevSales > 0 ? +((totalSales - prevSales) / prevSales * 100).toFixed(1) : null;

  // Daily chart
  const dailyMap: Record<string, { revenue: number; count: number }> = {};
  for (const dateStr of fillDates(from, to)) dailyMap[dateStr] = { revenue: 0, count: 0 };
  for (const o of served) {
    const key = bkkDateKey(o.createdAt);
    if (dailyMap[key]) {
      dailyMap[key].revenue += o.totalTHB;
      dailyMap[key].count++;
    }
  }
  const chart = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }));

  return NextResponse.json({ totalSales, totalBills, avgBasket, voidAmount, pctChange, chart });
}
