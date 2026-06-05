import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

const BKK = 7 * 3600_000;

// GET /api/hr/absent?date=YYYY-MM-DD — staff with schedule but no check-in on that date
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["OWNER", "MANAGER"].includes(session.user.role ?? ""))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dateParam = req.nextUrl.searchParams.get("date");
    const bkkNow = new Date(Date.now() + BKK);
    const dateStr = dateParam ?? bkkNow.toISOString().slice(0, 10);

    const targetDate = new Date(`${dateStr}T00:00:00+07:00`);
    const nextDate = new Date(targetDate.getTime() + 86400_000);
    const dayOfWeek = targetDate.getDay(); // 0=Sun … 6=Sat
    const month = targetDate.getMonth() + 1;
    const year = targetDate.getFullYear();

    // Staff who have a schedule on this day of week
    const scheduledStaff = await db.hrSchedule.findMany({
      where: { dayOfWeek },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    if (scheduledStaff.length === 0) return NextResponse.json([]);

    const scheduledIds = scheduledStaff.map((s) => s.staffId);

    // Who checked in that day
    const checkedIn = await db.hrAttendance.findMany({
      where: { staffId: { in: scheduledIds }, checkIn: { gte: targetDate, lt: nextDate } },
      select: { staffId: true },
    });
    const checkedInIds = new Set(checkedIn.map((a) => a.staffId));

    // Who already has an absent deduction this month
    const alreadyDeducted = await db.hrDeduction.findMany({
      where: {
        staffId: { in: scheduledIds },
        reason: "ขาดงาน",
        month,
        year,
        createdAt: { gte: targetDate, lt: nextDate },
      },
      select: { staffId: true },
    });
    const deductedIds = new Set(alreadyDeducted.map((d) => d.staffId));

    const absent = scheduledStaff
      .filter((s) => !checkedInIds.has(s.staffId))
      .map((s) => ({
        staffId: s.staffId,
        name: `${s.staff.user.firstName} ${s.staff.user.lastName}`.trim(),
        alreadyDeducted: deductedIds.has(s.staffId),
      }));

    return NextResponse.json(absent);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// POST /api/hr/absent — apply absent deductions for given staffIds on a date
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["OWNER", "MANAGER"].includes(session.user.role ?? ""))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { staffIds, date } = await req.json() as { staffIds: number[]; date: string };
    if (!staffIds?.length || !date) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

    const cfg = await db.hrLateConfig.findFirst();
    if (!cfg || cfg.absentDeductionAmount <= 0)
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่าจำนวนเงินหักขาดงาน — ไปตั้งค่าที่หน้า 'ตั้งค่า HR' ก่อน" }, { status: 422 });

    const targetDate = new Date(`${date}T00:00:00+07:00`);
    const month = targetDate.getMonth() + 1;
    const year = targetDate.getFullYear();

    let applied = 0;
    for (const staffId of staffIds) {
      try {
        await db.hrDeduction.create({
          data: {
            staffId,
            amount: cfg.absentDeductionAmount,
            reason: "ขาดงาน",
            note: `วันที่ ${date}`,
            month,
            year,
          },
        });
        applied++;
      } catch {
        // skip duplicate
      }
    }

    return NextResponse.json({ applied });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
