import { NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bkkNow = new Date(Date.now() + 7 * 3600_000);
  const dateStr = bkkNow.toISOString().slice(0, 10);
  const today = new Date(`${dateStr}T00:00:00+07:00`);
  const tomorrow = new Date(today.getTime() + 86400_000);

  const [allStaff, todayAttendances, checklists, taskCounts, overdueCount] = await Promise.all([
    db.hrStaff.findMany({
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.hrAttendance.findMany({
      where: { checkIn: { gte: today, lt: tomorrow } },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { checkIn: "asc" },
    }),
    db.hrChecklist.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      include: {
        items: true,
        staff: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    }),
    db.hrTask.groupBy({ by: ["status"], _count: { id: true } }),
    db.hrTask.count({ where: { status: { not: "DONE" }, deadline: { lt: today } } }),
  ]);

  const checkedInStaffIds = new Set(
    todayAttendances.filter((a) => a.checkOut === null).map((a) => a.staffId)
  );
  const attendedToday = new Set(todayAttendances.map((a) => a.staffId));
  const lateToday = todayAttendances.filter((a) => a.checkInStatus === "LATE").length;

  return NextResponse.json({
    staff: allStaff.map((s) => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      avatarUrl: s.user.avatarUrl,
      isCheckedIn: checkedInStaffIds.has(s.id),
      attendedToday: attendedToday.has(s.id),
    })),
    attendances: todayAttendances.map((a) => ({
      id: a.id,
      staffName: `${a.staff.user.firstName} ${a.staff.user.lastName}`.trim(),
      checkIn: a.checkIn,
      checkOut: a.checkOut,
      checkInStatus: a.checkInStatus,
      photoUrl: a.photoUrl,
    })),
    checklists: checklists.map((c) => ({
      id: c.id,
      type: c.type,
      staffName: `${c.staff.user.firstName} ${c.staff.user.lastName}`.trim(),
      totalItems: c.items.length,
      doneItems: c.items.filter((i) => i.done).length,
    })),
    taskCounts: Object.fromEntries(taskCounts.map((t) => [t.status, t._count.id])),
    lateToday,
    overdueCount,
  });
}
