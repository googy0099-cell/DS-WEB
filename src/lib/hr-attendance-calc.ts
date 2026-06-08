// Pure attendance/deduction math — no DB/IO so it can be unit-tested directly.
// All schedule times are interpreted in Bangkok time (UTC+7).
// checkIn/Out come in as Date (UTC). Convert to BKK HH:MM for comparison.

export type AttendanceStatus = "ON_TIME" | "LATE" | "EARLY" | null;

export type Schedule = { startTime: string; endTime: string; graceMinutes: number };

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

function bkkHourMinute(d: Date): { h: number; m: number } {
  const bkk = new Date(d.getTime() + BKK_OFFSET_MS);
  return { h: bkk.getUTCHours(), m: bkk.getUTCMinutes() };
}

function toMinutes(h: number, m: number) {
  return h * 60 + m;
}

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map(Number);
  return { h, m };
}

export function computeCheckInStatus(
  checkIn: Date,
  schedule: Schedule | null
): AttendanceStatus {
  if (!schedule) return null;
  const now = bkkHourMinute(checkIn);
  const start = parseHHMM(schedule.startTime);
  const cutoff = toMinutes(start.h, start.m) + schedule.graceMinutes;
  return toMinutes(now.h, now.m) <= cutoff ? "ON_TIME" : "LATE";
}

// Returns how many minutes past the grace cutoff the check-in was (0 if on time)
export function computeLateMinutes(checkIn: Date, schedule: Schedule | null): number {
  if (!schedule) return 0;
  const now = bkkHourMinute(checkIn);
  const start = parseHHMM(schedule.startTime);
  const cutoff = toMinutes(start.h, start.m) + schedule.graceMinutes;
  return Math.max(0, toMinutes(now.h, now.m) - cutoff);
}

// Compute deduction amount based on config type
// FIXED: deductionAmount (฿) × lateMinutes
// PERCENT: (deductionAmount% of daily wage) × lateMinutes
export function computeLateDeductionAmount(
  lateMinutes: number,
  config: { deductionType: string; deductionAmount: number; lateDeductionMax?: number },
  staff: { baseSalary: number; payType: string }
): number {
  if (lateMinutes <= 0 || config.deductionAmount <= 0) return 0;
  const dailyWage =
    staff.payType === "DAILY" ? staff.baseSalary
    : staff.payType === "HOURLY" ? staff.baseSalary * 8
    : staff.baseSalary / 30;
  const raw =
    config.deductionType === "PERCENT"
      ? (config.deductionAmount / 100) * dailyWage * lateMinutes
      : config.deductionAmount * lateMinutes;
  // Cap: an explicit lateDeductionMax wins; otherwise default to one day's wage so
  // a single day's late penalty can never exceed what the staff earns that day.
  // (Skipped when the wage is unknown so a FIXED penalty isn't silently zeroed.)
  const explicitMax = config.lateDeductionMax ?? 0;
  const cap = explicitMax > 0 ? explicitMax : dailyWage > 0 ? Math.round(dailyWage) : 0;
  const capped = cap > 0 ? Math.min(raw, cap) : raw;
  return Math.max(1, Math.round(capped));
}

// Per-day deduction (absent / task overdue) — same logic as late but unit is "days" not "minutes"
export function computeDailyDeductionAmount(
  days: number,
  config: { deductionType: string; deductionAmount: number },
  staff: { baseSalary: number; payType: string }
): number {
  if (days <= 0 || config.deductionAmount <= 0) return 0;
  if (config.deductionType === "PERCENT") {
    const dailyWage =
      staff.payType === "DAILY" ? staff.baseSalary
      : staff.payType === "HOURLY" ? staff.baseSalary * 8
      : staff.baseSalary / 30;
    return Math.max(1, Math.round((config.deductionAmount / 100) * dailyWage * days));
  }
  return config.deductionAmount * days;
}

export function computeCheckOutStatus(
  checkOut: Date,
  schedule: Schedule | null
): AttendanceStatus {
  if (!schedule) return null;
  const now = bkkHourMinute(checkOut);
  const end = parseHHMM(schedule.endTime);
  return toMinutes(now.h, now.m) >= toMinutes(end.h, end.m) ? "ON_TIME" : "EARLY";
}

// Day-of-week in Bangkok time: 0=Sunday..6=Saturday
export function bkkDayOfWeek(d: Date): number {
  const bkk = new Date(d.getTime() + BKK_OFFSET_MS);
  return bkk.getUTCDay();
}
