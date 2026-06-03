import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { syncAttendanceToSheets } from "@/lib/hr-sheets";

export async function POST(req: NextRequest) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { date } = (await req.json()) as { date?: string };

  // Default to today (Bangkok time)
  const bkkNow = new Date(Date.now() + 7 * 3600_000);
  const dateStr = date ?? bkkNow.toISOString().slice(0, 10);

  const startOfDay = new Date(`${dateStr}T00:00:00+07:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59+07:00`);

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

  // Date label in Thai
  const d = new Date(dateStr);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const dateLabel = `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;

  const result = await syncAttendanceToSheets(rows, dateLabel);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, synced: rows.length, date: dateStr });
}
