import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { computeDailyDeductionAmount, bkkDayOfWeek } from "@/lib/hr-attendance";

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
    // BKK-correct: derive the weekday from the BKK calendar date, not server-local time.
    const dayOfWeek = bkkDayOfWeek(targetDate); // 0=Sun … 6=Sat, in Bangkok time

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

    // Who already has an absent deduction for THIS date (keyed by source, not by
    // reason text or createdAt — works for past dates and PERCENT-mode reasons too).
    const alreadyDeducted = await db.hrDeduction.findMany({
      where: {
        sourceType: "ABSENT",
        sourceId: { in: scheduledIds.map((id) => `${id}:${dateStr}`) },
      },
      select: { sourceId: true },
    });
    const deductedIds = new Set(alreadyDeducted.map((d) => Number(d.sourceId!.split(":")[0])));

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

    // BKK-correct: month/year come straight from the BKK calendar date string.
    const [year, month] = date.split("-").map(Number);

    // Load staff payroll info if PERCENT mode (need per-staff daily wage)
    const isPercent = cfg.absentDeductionType === "PERCENT";
    const staffMap = isPercent
      ? await db.hrStaff.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, baseSalary: true, payType: true },
        })
      : [];
    const staffById = Object.fromEntries(staffMap.map((s) => [s.id, s]));

    const typeLabel = isPercent ? ` (${cfg.absentDeductionAmount}% ของค่าจ้างรายวัน)` : "";

    let applied = 0;
    for (const staffId of staffIds) {
      try {
        const amount = isPercent
          ? computeDailyDeductionAmount(
              1,
              { deductionType: "PERCENT", deductionAmount: cfg.absentDeductionAmount },
              { baseSalary: staffById[staffId]?.baseSalary ?? 0, payType: staffById[staffId]?.payType ?? "MONTHLY" }
            )
          : cfg.absentDeductionAmount;

        await db.hrDeduction.create({
          data: {
            staffId,
            amount,
            reason: `ขาดงาน${typeLabel}`,
            note: `วันที่ ${date}`,
            month,
            year,
            sourceType: "ABSENT",
            sourceId: `${staffId}:${date}`,
          },
        });
        applied++;
      } catch {
        // unique (sourceType, sourceId) violation = already deducted for this date → skip
      }
    }

    return NextResponse.json({ applied });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
