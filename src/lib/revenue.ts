import db from "@/lib/db";

// ─── date helpers (Bangkok = UTC+7) ──────────────────────────────────────────

export function parseDateRange(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  // Bangkok midnight → UTC (BKK 00:00 = UTC −7h = prev day 17:00)
  const start = new Date(Date.UTC(fy, fm - 1, fd, -7, 0, 0));
  const end = new Date(Date.UTC(ty, tm - 1, td + 1, -7, 0, 0));
  return { start, end };
}

export function bkkDateKey(utcDate: Date): string {
  return new Date(utcDate.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

export function fillDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export function addDays(d: string, n: number): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// ─── revenue (single source of truth = confirmed payments) ────────────────────

export type RevenueResult = {
  foodRevenue: number;
  gametimeRevenue: number;
  totalRevenue: number;
  cashTotal: number;
  transferTotal: number;
  billCount: number;
  avgBasket: number;
  chart: { date: string; revenue: number; count: number }[];
};

/**
 * Net revenue actually collected in [from, to] (Bangkok calendar days).
 *
 * Revenue = sum of CONFIRMED Payment.amountTHB (net of discount/comp — the amount
 * actually received), keyed by confirmedAt. Everything sold — food, drinks, AND
 * game-time packages — is an order line item, so payments are the complete and
 * only revenue source. PlayerSession.packagePrice is a denormalized display copy
 * and is intentionally NOT summed here (it would double-count the gametime line
 * items on tab orders). Payments whose order was CANCELLED are excluded so they
 * don't double-count against voidAmount.
 *
 * The food vs game-time split is derived from order-item category and allocated
 * proportionally so the two figures sum to the net total.
 */
export async function computeRevenue(from: string, to: string): Promise<RevenueResult> {
  const { start, end } = parseDateRange(from, to);

  const [payments, items] = await Promise.all([
    db.payment.findMany({
      where: { status: "CONFIRMED", confirmedAt: { gte: start, lt: end } },
      select: {
        amountTHB: true,
        method: true,
        confirmedAt: true,
        order: { select: { status: true, billId: true } },
      },
    }),
    db.orderItem.findMany({
      where: {
        cancelledAt: null,
        order: {
          status: { not: "CANCELLED" },
          payment: { status: "CONFIRMED", confirmedAt: { gte: start, lt: end } },
        },
      },
      select: { quantity: true, unitPriceTHB: true, menuItem: { select: { category: true } } },
    }),
  ]);

  const validPayments = payments.filter((p) => p.order && p.order.status !== "CANCELLED");

  const totalRevenue = validPayments.reduce((s, p) => s + p.amountTHB, 0);
  const cashTotal = validPayments
    .filter((p) => p.method === "CASH")
    .reduce((s, p) => s + p.amountTHB, 0);
  const transferTotal = validPayments
    .filter((p) => p.method !== "CASH")
    .reduce((s, p) => s + p.amountTHB, 0);

  // Bill/transaction count: distinct bills + standalone (non-bill) orders
  const billIds = new Set<number>();
  let standalone = 0;
  for (const p of validPayments) {
    if (p.order?.billId != null) billIds.add(p.order.billId);
    else standalone++;
  }
  const billCount = billIds.size + standalone;
  const avgBasket = billCount > 0 ? Math.round(totalRevenue / billCount) : 0;

  // Food vs game-time split (gross by category → allocated proportionally to net)
  let gametimeGross = 0;
  let totalGross = 0;
  for (const it of items) {
    const amt = it.quantity * it.unitPriceTHB;
    totalGross += amt;
    if (it.menuItem.category === "gametime") gametimeGross += amt;
  }
  const gametimeRevenue = totalGross > 0 ? Math.round((totalRevenue * gametimeGross) / totalGross) : 0;
  const foodRevenue = totalRevenue - gametimeRevenue;

  // Daily chart (revenue by money-received date)
  const dailyMap: Record<string, { revenue: number; count: number }> = {};
  for (const d of fillDates(from, to)) dailyMap[d] = { revenue: 0, count: 0 };
  for (const p of validPayments) {
    if (!p.confirmedAt) continue;
    const k = bkkDateKey(p.confirmedAt);
    if (dailyMap[k]) {
      dailyMap[k].revenue += p.amountTHB;
      dailyMap[k].count++;
    }
  }
  const chart = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }));

  return {
    foodRevenue,
    gametimeRevenue,
    totalRevenue,
    cashTotal,
    transferTotal,
    billCount,
    avgBasket,
    chart,
  };
}
