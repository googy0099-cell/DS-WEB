import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { syncAttendanceToSheets } from "@/lib/hr-sheets";

const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export async function POST(req: NextRequest) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { date?: string; year?: number; month?: number };

  const bkkNow = new Date(Date.now() + 7 * 3600_000);

  // Month-range sync (from payroll page)
  if (body.year && body.month) {
    const year = Number(body.year);
    const month = Number(body.month);
    const start = new Date(Date.UTC(year, month - 1, 1) - 7 * 3600_000);
    const end = new Date(Date.UTC(year, month, 1) - 7 * 3600_000);

    try {
      const attendances = await db.hrAttendance.findMany({
        where: { checkIn: { gte: start, lt: end } },
        include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { checkIn: "asc" },
      });

      const rows = attendances.map((a) => ({
        staffName: `${a.staff.user.firstName} ${a.staff.user.lastName}`.trim(),
        checkIn: a.checkIn,
        checkOut: a.checkOut,
      }));

      const monthLabel = `${MONTHS_TH[month - 1]} ${year + 543}`;
      const result = await syncAttendanceToSheets(rows, monthLabel);

      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
      return NextResponse.json({ ok: true, synced: rows.length, month: monthLabel });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // Single-day sync (legacy / HR dashboard)
  const dateStr = body.date ?? bkkNow.toISOString().slice(0, 10);
  const startOfDay = new Date(`${dateStr}T00:00:00+07:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59+07:00`);

  try {
    const attendances = await db.hrAttendance.findMany({
      where: { checkIn: { gte: startOfDay, lte: endOfDay } },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { checkIn: "asc" },
    });

    const rows = attendances.map((a) => ({
      staffName: `${a.staff.user.firstName} ${a.staff.user.lastName}`.trim(),
      checkIn: a.checkIn,
      checkOut: a.checkOut,
    }));

    const d = new Date(dateStr);
    const dateLabel = `${d.getUTCDate()} ${MONTHS_TH[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
    const result = await syncAttendanceToSheets(rows, dateLabel);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true, synced: rows.length, date: dateStr });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
