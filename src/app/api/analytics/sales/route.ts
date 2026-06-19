import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { computeRevenue, parseDateRange, addDays } from "@/lib/revenue";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["OWNER", "CASHIER"].includes(session.user.role)) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const from = searchParams.get("from") || today;
  const to = searchParams.get("to") || today;

  const { start, end } = parseDateRange(from, to);

  // Previous period of equal length, immediately before `from`
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400_000) + 1;
  const prevFrom = addDays(from, -days);
  const prevTo = addDays(from, -1);

  const [rev, prev, cancelledAgg] = await Promise.all([
    computeRevenue(from, to),
    computeRevenue(prevFrom, prevTo),
    db.order.aggregate({
      where: { status: "CANCELLED", createdAt: { gte: start, lt: end } },
      _sum: { totalTHB: true },
    }),
  ]);

  const pctChange =
    prev.totalRevenue > 0
      ? +(((rev.totalRevenue - prev.totalRevenue) / prev.totalRevenue) * 100).toFixed(1)
      : null;

  return NextResponse.json({
    totalSales: rev.totalRevenue,
    foodRevenue: rev.foodRevenue,
    gametimeRevenue: rev.gametimeRevenue,
    totalBills: rev.billCount,
    avgBasket: rev.avgBasket,
    voidAmount: cancelledAgg._sum.totalTHB ?? 0,
    pctChange,
    chart: rev.chart,
  });
}
