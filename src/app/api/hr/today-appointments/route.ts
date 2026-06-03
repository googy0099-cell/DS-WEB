import { NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

const BKK = 7 * 3600_000;

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!role || !["CASHIER", "STAFF", "OWNER"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date(Date.now() + BKK);
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 3600_000);
    const laterStr = sevenDaysLater.toISOString().slice(0, 10);

    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    const start = new Date(`${todayStr}T00:00:00+07:00`);
    const end = new Date(`${laterStr}T23:59:59+07:00`);

    // One-off events in next 7 days
    const oneOff = await db.hrPaymentEvent.findMany({
      where: {
        date: { gte: start, lte: end },
        recurrence: null,
        type: { in: ["APPOINTMENT", "HOLIDAY"] },
      },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { date: "asc" },
    });

    // Recurring events — project to this and next month
    const recurring = await db.hrPaymentEvent.findMany({
      where: { recurrence: "MONTHLY", type: { in: ["APPOINTMENT", "HOLIDAY"] } },
    });

    const projected = recurring.flatMap(e => {
      const day = Math.min(new Date(e.date.getTime() + BKK).getUTCDate(), daysInMonth);
      const dates: string[] = [];
      // Current month
      const thisMonthDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (thisMonthDate >= todayStr && thisMonthDate <= laterStr) dates.push(thisMonthDate);
      // Next month if 7-day window crosses month boundary
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const daysInNext = new Date(nextYear, nextMonth, 0).getDate();
      const nextDay = Math.min(day, daysInNext);
      const nextMonthDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
      if (nextMonthDate >= todayStr && nextMonthDate <= laterStr) dates.push(nextMonthDate);

      return dates.map(date => ({
        id: e.id,
        date,
        description: e.description,
        type: e.type,
        notifyDaysBefore: e.notifyDaysBefore,
        isRecurring: true,
        staffName: null,
      }));
    });

    const result = [
      ...oneOff.map(e => ({
        id: e.id,
        date: new Date(e.date.getTime() + BKK).toISOString().slice(0, 10),
        description: e.description,
        type: e.type,
        notifyDaysBefore: e.notifyDaysBefore,
        isRecurring: false,
        staffName: e.staff ? `${e.staff.user.firstName} ${e.staff.user.lastName}`.trim() : null,
      })),
      ...projected,
    ].sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
