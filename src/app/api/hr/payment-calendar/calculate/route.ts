import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

const BKK = 7 * 3600_000;

export async function GET(req: NextRequest) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const staffId = Number(url.searchParams.get("staffId"));
  const toDate = url.searchParams.get("toDate"); // "YYYY-MM-DD"

  if (!staffId || !toDate) {
    return NextResponse.json({ error: "ต้องระบุ staffId และ toDate" }, { status: 400 });
  }

  try {
    const staff = await db.hrStaff.findUnique({
      where: { id: staffId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!staff) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });

    // Find last paid payment event for this staff
    const lastPaid = await db.hrPaymentEvent.findFirst({
      where: { staffId, isPaid: true, type: { in: ["SALARY", "DAILY", "HOURLY"] } },
      orderBy: { date: "desc" },
    });

    // Period start: day after last payment, or 1st of current BKK month
    let fromDate: Date;
    if (lastPaid) {
      const after = new Date(lastPaid.date.getTime() + 24 * 3600_000);
      fromDate = new Date(Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate()) - BKK);
    } else {
      const bkk = new Date(Date.now() + BKK);
      fromDate = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), 1) - BKK);
    }

    const toEnd = new Date(`${toDate}T23:59:59+07:00`);

    // Attendance in this period
    const attendances = await db.hrAttendance.findMany({
      where: { staffId, checkIn: { gte: fromDate, lte: toEnd } },
    });

    // Group by BKK date: one work-day per calendar day
    const byDate = new Map<string, { firstIn: Date; lastOut: Date | null }>();
    for (const a of attendances) {
      const key = new Date(a.checkIn.getTime() + BKK).toISOString().slice(0, 10);
      const entry = byDate.get(key);
      if (!entry) {
        byDate.set(key, { firstIn: a.checkIn, lastOut: a.checkOut });
      } else {
        if (a.checkIn < entry.firstIn) entry.firstIn = a.checkIn;
        if (a.checkOut && (!entry.lastOut || a.checkOut > entry.lastOut)) entry.lastOut = a.checkOut;
      }
    }
    const daysWorked = byDate.size;
    let workMinutes = 0;
    for (const { firstIn, lastOut } of byDate.values()) {
      if (lastOut) {
        const ms = lastOut.getTime() - firstIn.getTime();
        if (ms > 0) workMinutes += Math.floor(ms / 60000);
      }
    }

    let gross = 0;
    if (staff.payType === "DAILY") gross = staff.baseSalary * daysWorked;
    else if (staff.payType === "HOURLY") gross = Math.round(staff.baseSalary * workMinutes / 60);
    else gross = staff.baseSalary; // MONTHLY

    // Deductions incurred during this pay period (late / absent / task / checklist /
    // manual). Period starts the day after the last payment, so these are never
    // double-counted across periods. The actual payout must be net of these.
    const periodDeductions = await db.hrDeduction.findMany({
      where: { staffId, createdAt: { gte: fromDate, lte: toEnd } },
      orderBy: { createdAt: "asc" },
      select: { id: true, amount: true, reason: true, note: true, createdAt: true },
    });
    const totalDeductions = periodDeductions.reduce((sum, d) => sum + d.amount, 0);
    const net = Math.max(0, gross - totalDeductions);

    const fromDateStr = new Date(fromDate.getTime() + BKK).toISOString().slice(0, 10);

    return NextResponse.json({
      staffId,
      name: `${staff.user.firstName} ${staff.user.lastName}`.trim(),
      payType: staff.payType,
      payRate: staff.baseSalary,
      fromDate: fromDateStr,
      toDate,
      daysWorked,
      workMinutes,
      gross,
      deductions: periodDeductions,
      totalDeductions,
      net,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
