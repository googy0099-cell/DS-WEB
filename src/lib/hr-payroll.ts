import db from "@/lib/db";

export type MonthlySummary = {
  daysWorked: number;
  onTimeCount: number;
  lateCount: number;
  earlyLeaveCount: number;
  workMinutes: number; // total minutes worked across all completed attendances
};

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

function bkkRangeForMonth(year: number, month: number) {
  // month is 1-12. Returns UTC Date range that covers the BKK calendar month.
  // BKK midnight is UTC midnight - 7h.
  const startBkk = Date.UTC(year, month - 1, 1, 0, 0, 0);
  const endBkk = Date.UTC(year, month, 1, 0, 0, 0); // first second of next month
  return {
    start: new Date(startBkk - BKK_OFFSET_MS),
    end: new Date(endBkk - BKK_OFFSET_MS),
  };
}

export async function getMonthlySummary(
  staffId: number,
  year: number,
  month: number
): Promise<MonthlySummary> {
  const { start, end } = bkkRangeForMonth(year, month);

  const rows = await db.hrAttendance.findMany({
    where: {
      staffId,
      checkIn: { gte: start, lt: end },
    },
  });

  // Group by BKK date — one work-day per calendar day, use first check-in + last check-out
  const byDate = new Map<string, { firstIn: (typeof rows)[0]; lastOut: Date | null }>();
  for (const r of rows) {
    const key = new Date(r.checkIn.getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10);
    const entry = byDate.get(key);
    if (!entry) {
      byDate.set(key, { firstIn: r, lastOut: r.checkOut });
    } else {
      if (r.checkIn < entry.firstIn.checkIn) entry.firstIn = r;
      if (r.checkOut && (!entry.lastOut || r.checkOut > entry.lastOut)) entry.lastOut = r.checkOut;
    }
  }

  let daysWorked = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let earlyLeaveCount = 0;
  let workMinutes = 0;

  for (const { firstIn, lastOut } of byDate.values()) {
    daysWorked += 1;
    if (firstIn.checkInStatus === "ON_TIME") onTimeCount += 1;
    if (firstIn.checkInStatus === "LATE") lateCount += 1;
    if (firstIn.checkOutStatus === "EARLY") earlyLeaveCount += 1;
    if (lastOut) {
      const ms = lastOut.getTime() - firstIn.checkIn.getTime();
      if (ms > 0) workMinutes += Math.floor(ms / 60000);
    }
  }

  return { daysWorked, onTimeCount, lateCount, earlyLeaveCount, workMinutes };
}
