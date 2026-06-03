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

  let daysWorked = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let earlyLeaveCount = 0;
  let workMinutes = 0;

  for (const r of rows) {
    daysWorked += 1;
    if (r.checkInStatus === "ON_TIME") onTimeCount += 1;
    if (r.checkInStatus === "LATE") lateCount += 1;
    if (r.checkOutStatus === "EARLY") earlyLeaveCount += 1;
    if (r.checkOut) {
      const ms = r.checkOut.getTime() - r.checkIn.getTime();
      if (ms > 0) workMinutes += Math.floor(ms / 60000);
    }
  }

  return { daysWorked, onTimeCount, lateCount, earlyLeaveCount, workMinutes };
}
