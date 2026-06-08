import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeCheckInStatus,
  computeCheckOutStatus,
  computeLateMinutes,
  computeLateDeductionAmount,
  computeDailyDeductionAmount,
  bkkDayOfWeek,
} from "../src/lib/hr-attendance-calc.ts";

// All schedule times are Bangkok (UTC+7). Helper to build a UTC Date from a BKK wall-clock time.
function bkk(dateStr: string, hhmm: string): Date {
  return new Date(`${dateStr}T${hhmm}:00+07:00`);
}

const sched = { startTime: "09:00", endTime: "18:00", graceMinutes: 10 };

// ─────────────────────────────────────────────────────────────────────────────
// Check-in status (late detection) — BKK timezone correctness
// ─────────────────────────────────────────────────────────────────────────────
test("ON_TIME exactly at the grace cutoff", () => {
  assert.equal(computeCheckInStatus(bkk("2026-06-08", "09:10"), sched), "ON_TIME");
});

test("LATE one minute past the grace cutoff", () => {
  assert.equal(computeCheckInStatus(bkk("2026-06-08", "09:11"), sched), "LATE");
});

test("ON_TIME when arriving before start", () => {
  assert.equal(computeCheckInStatus(bkk("2026-06-08", "08:30"), sched), "ON_TIME");
});

test("null status when no schedule for the day", () => {
  assert.equal(computeCheckInStatus(bkk("2026-06-08", "12:00"), null), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Late minutes — drives the deduction quantity
// ─────────────────────────────────────────────────────────────────────────────
test("lateMinutes is measured from the grace cutoff, not the start time", () => {
  // start 09:00 + grace 10 = cutoff 09:10; arrive 09:25 => 15 min late
  assert.equal(computeLateMinutes(bkk("2026-06-08", "09:25"), sched), 15);
});

test("lateMinutes is 0 within the grace window", () => {
  assert.equal(computeLateMinutes(bkk("2026-06-08", "09:05"), sched), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// FIXED late deduction = amount per minute
// ─────────────────────────────────────────────────────────────────────────────
test("FIXED late deduction = ฿/min × lateMinutes", () => {
  const amount = computeLateDeductionAmount(
    15,
    { deductionType: "FIXED", deductionAmount: 5 },
    { baseSalary: 30000, payType: "MONTHLY" }
  );
  assert.equal(amount, 75); // 5 × 15
});

test("FIXED late deduction respects lateDeductionMax cap", () => {
  const amount = computeLateDeductionAmount(
    60,
    { deductionType: "FIXED", deductionAmount: 5, lateDeductionMax: 100 },
    { baseSalary: 30000, payType: "MONTHLY" }
  );
  assert.equal(amount, 100); // raw 300 capped to 100
});

test("zero late minutes => zero deduction", () => {
  assert.equal(
    computeLateDeductionAmount(0, { deductionType: "FIXED", deductionAmount: 5 }, { baseSalary: 30000, payType: "MONTHLY" }),
    0
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PERCENT late deduction — depends on daily wage derived from payType
// NOTE: PERCENT late multiplies per-minute, which compounds extremely fast.
// ─────────────────────────────────────────────────────────────────────────────
test("PERCENT late deduction for MONTHLY uses baseSalary/30 as daily wage", () => {
  // dailyWage = 30000/30 = 1000; 1%/min × 10 min = 0.01×1000×10 = 100
  const amount = computeLateDeductionAmount(
    10,
    { deductionType: "PERCENT", deductionAmount: 1 },
    { baseSalary: 30000, payType: "MONTHLY" }
  );
  assert.equal(amount, 100);
});

test("PERCENT late is auto-capped at one day's wage when no explicit max is set", () => {
  // dailyWage = 30000/30 = 1000; raw 2%/min × 60 = ฿1200, but capped to ฿1000.
  const amount = computeLateDeductionAmount(
    60,
    { deductionType: "PERCENT", deductionAmount: 2 },
    { baseSalary: 30000, payType: "MONTHLY" }
  );
  assert.equal(amount, 1000, "late penalty must never exceed the day's wage");
});

test("an explicit lateDeductionMax still overrides the auto day-wage cap", () => {
  const amount = computeLateDeductionAmount(
    60,
    { deductionType: "PERCENT", deductionAmount: 2, lateDeductionMax: 300 },
    { baseSalary: 30000, payType: "MONTHLY" }
  );
  assert.equal(amount, 300);
});

test("FIXED late is NOT zeroed when staff salary is unknown (no auto cap)", () => {
  // baseSalary 0 => dailyWage 0 => skip the auto cap, keep the fixed penalty.
  const amount = computeLateDeductionAmount(
    15,
    { deductionType: "FIXED", deductionAmount: 5 },
    { baseSalary: 0, payType: "MONTHLY" }
  );
  assert.equal(amount, 75);
});

// ─────────────────────────────────────────────────────────────────────────────
// Daily deduction (absent / task overdue)
// ─────────────────────────────────────────────────────────────────────────────
test("FIXED daily deduction = amount × days", () => {
  assert.equal(
    computeDailyDeductionAmount(3, { deductionType: "FIXED", deductionAmount: 200 }, { baseSalary: 30000, payType: "MONTHLY" }),
    600
  );
});

test("PERCENT daily deduction for DAILY payType uses baseSalary directly", () => {
  // daily worker @ ฿500/day, 50% absent deduction × 1 day = 250
  assert.equal(
    computeDailyDeductionAmount(1, { deductionType: "PERCENT", deductionAmount: 50 }, { baseSalary: 500, payType: "DAILY" }),
    250
  );
});

test("PERCENT daily deduction for HOURLY treats daily wage as rate×8", () => {
  // hourly @ ฿60/hr => daily wage 480; 100% × 1 day = 480
  assert.equal(
    computeDailyDeductionAmount(1, { deductionType: "PERCENT", deductionAmount: 100 }, { baseSalary: 60, payType: "HOURLY" }),
    480
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Check-out status (early leave)
// ─────────────────────────────────────────────────────────────────────────────
test("EARLY when leaving before end time", () => {
  assert.equal(computeCheckOutStatus(bkk("2026-06-08", "17:30"), sched), "EARLY");
});

test("ON_TIME when leaving exactly at end time", () => {
  assert.equal(computeCheckOutStatus(bkk("2026-06-08", "18:00"), sched), "ON_TIME");
});

// ─────────────────────────────────────────────────────────────────────────────
// Gross pay by pay type — mirrors calcGross in payroll & calendar routes
// ─────────────────────────────────────────────────────────────────────────────
function calcGross(payType: string, rate: number, s: { daysWorked: number; workMinutes: number }) {
  if (payType === "DAILY") return rate * s.daysWorked;
  if (payType === "HOURLY") return Math.round((rate * s.workMinutes) / 60);
  return rate; // MONTHLY
}

test("DAILY gross = rate × daysWorked", () => {
  assert.equal(calcGross("DAILY", 500, { daysWorked: 22, workMinutes: 0 }), 11000);
});

test("HOURLY gross = round(rate × minutes / 60)", () => {
  // 8h05m = 485 min @ ฿60/hr = 485 => round(60×485/60)=485
  assert.equal(calcGross("HOURLY", 60, { daysWorked: 1, workMinutes: 485 }), 485);
});

test("MONTHLY gross is the flat rate regardless of days worked", () => {
  assert.equal(calcGross("MONTHLY", 30000, { daysWorked: 22, workMinutes: 10560 }), 30000);
});

test("LEAK: MONTHLY gross ignores daysWorked — a month with 1 day worked still pays full salary", () => {
  // The calendar 'calculate' route returns this gross with no proration and no
  // deduction subtraction, so partial-month monthly staff are overpaid.
  assert.equal(calcGross("MONTHLY", 30000, { daysWorked: 1, workMinutes: 480 }), 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// bkkDayOfWeek — used to match the weekly schedule
// ─────────────────────────────────────────────────────────────────────────────
test("bkkDayOfWeek returns Monday(1) for a BKK Monday even near the UTC date boundary", () => {
  // 2026-06-08 is a Monday in BKK. 00:30 BKK = 17:30 UTC on Sunday the 7th.
  // A correct BKK-aware computation must still return 1 (Monday).
  assert.equal(bkkDayOfWeek(bkk("2026-06-08", "00:30")), 1);
});

test("REGRESSION GUARD: naive getDay() on a +07:00 instant returns the WRONG weekday", () => {
  // This documents the bug pattern in /api/hr/absent which calls
  // new Date(`${date}T00:00:00+07:00`).getDay() in server-local (UTC) time.
  const naive = new Date("2026-06-08T00:00:00+07:00").getUTCDay(); // simulates UTC server
  assert.equal(naive, 0, "naive UTC getDay yields Sunday(0) for a BKK Monday — schedule mismatch");
  assert.notEqual(naive, bkkDayOfWeek(bkk("2026-06-08", "00:00")));
});
