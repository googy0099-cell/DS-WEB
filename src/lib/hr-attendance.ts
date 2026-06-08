import db from "@/lib/db";
import { bkkDayOfWeek, type Schedule } from "@/lib/hr-attendance-calc";

// Pure attendance/deduction math lives in hr-attendance-calc.ts (no DB import,
// so it is unit-testable). Re-export it here so existing call-sites are unchanged.
export {
  computeCheckInStatus,
  computeLateMinutes,
  computeLateDeductionAmount,
  computeDailyDeductionAmount,
  computeCheckOutStatus,
  bkkDayOfWeek,
} from "@/lib/hr-attendance-calc";
export type { AttendanceStatus, Schedule } from "@/lib/hr-attendance-calc";

export async function getTodaySchedule(staffId: number, now: Date = new Date()): Promise<Schedule | null> {
  const dow = bkkDayOfWeek(now);
  const s = await db.hrSchedule.findUnique({
    where: { staffId_dayOfWeek: { staffId, dayOfWeek: dow } },
  });
  if (!s) return null;
  return { startTime: s.startTime, endTime: s.endTime, graceMinutes: s.graceMinutes };
}
