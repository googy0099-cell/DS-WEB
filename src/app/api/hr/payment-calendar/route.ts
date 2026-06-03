import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

const BKK = 7 * 3600_000;

function bkkDay(d: Date) {
  return new Date(d.getTime() + BKK).getUTCDate();
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const now = new Date(Date.now() + BKK);
  const year = Number(url.searchParams.get("year") ?? now.getUTCFullYear());
  const month = Number(url.searchParams.get("month") ?? now.getUTCMonth() + 1);

  const start = new Date(Date.UTC(year, month - 1, 1) - BKK);
  const end = new Date(Date.UTC(year, month, 1) - BKK);
  const daysInMonth = new Date(year, month, 0).getDate();

  try {
    // Regular (non-recurring) events in this month
    const regular = await db.hrPaymentEvent.findMany({
      where: { date: { gte: start, lt: end }, recurrence: null },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { date: "asc" },
    });

    // All recurring events (project their day-of-month into the current month)
    const recurring = await db.hrPaymentEvent.findMany({
      where: { recurrence: "MONTHLY" },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { date: "asc" },
    });

    // Paid instances created from recurring events for this month
    // (stored as note starting with "recurring:")
    const recurringInstances = await db.hrPaymentEvent.findMany({
      where: {
        date: { gte: start, lt: end },
        note: { startsWith: "recurring:" },
        recurrence: null,
      },
      select: { note: true },
    });
    const paidRecurringIds = new Set(
      recurringInstances
        .map(r => r.note?.replace("recurring:", "").trim())
        .filter(Boolean)
        .map(Number)
    );

    function fmt(e: (typeof regular)[number], overrideDate?: string, isRecurring?: boolean) {
      return {
        id: e.id,
        staffId: e.staffId,
        staffName: e.staff ? `${e.staff.user.firstName} ${e.staff.user.lastName}`.trim() : null,
        date: overrideDate ?? e.date.toISOString().slice(0, 10),
        amount: e.amount,
        description: e.description,
        type: e.type,
        recurrence: e.recurrence ?? null,
        notifyDaysBefore: e.notifyDaysBefore ?? null,
        isRecurring: isRecurring ?? false,
        isPaid: isRecurring ? paidRecurringIds.has(e.id) : e.isPaid,
        note: e.note,
      };
    }

    const regularFormatted = regular.map(e => fmt(e));

    const recurringFormatted = recurring.map(e => {
      const day = Math.min(bkkDay(e.date), daysInMonth);
      const projectedDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return fmt(e, projectedDate, true);
    });

    return NextResponse.json([...regularFormatted, ...recurringFormatted]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as {
      staffId?: number | null;
      date: string;
      amount: number;
      description: string;
      type?: string;
      recurrence?: string | null;
      notifyDaysBefore?: number | null;
      note?: string;
    };

    if (!body.date || body.amount === undefined || !body.description) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    const event = await db.hrPaymentEvent.create({
      data: {
        staffId: body.staffId ?? null,
        date: new Date(`${body.date}T00:00:00+07:00`),
        amount: body.amount,
        description: body.description,
        type: body.type ?? "SALARY",
        recurrence: body.recurrence ?? null,
        notifyDaysBefore: body.notifyDaysBefore ?? null,
        note: body.note ?? null,
      },
    });

    return NextResponse.json({ id: event.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as {
      id: number;
      isPaid?: boolean;
      amount?: number;
      note?: string;
      // For marking a projected recurring event as paid for a specific month
      recurringDate?: string;
    };

    // If marking a recurring event as paid for a projected date,
    // create a one-off paid instance instead of modifying the template
    if (typeof body.isPaid === "boolean" && body.recurringDate) {
      const template = await db.hrPaymentEvent.findUnique({ where: { id: body.id } });
      if (!template || template.recurrence !== "MONTHLY") {
        return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
      }
      if (body.isPaid) {
        // Create a paid instance for this specific month occurrence
        await db.hrPaymentEvent.create({
          data: {
            staffId: template.staffId,
            date: new Date(`${body.recurringDate}T00:00:00+07:00`),
            amount: template.amount,
            description: template.description,
            type: template.type,
            recurrence: null,
            isPaid: true,
            paidAt: new Date(),
            note: `recurring:${template.id}`,
          },
        });
      } else {
        // Remove the paid instance for this month
        await db.hrPaymentEvent.deleteMany({
          where: {
            date: new Date(`${body.recurringDate}T00:00:00+07:00`),
            note: `recurring:${body.id}`,
          },
        });
      }
      return NextResponse.json({ ok: true });
    }

    // Regular one-off event update
    const data: Record<string, unknown> = {};
    if (typeof body.isPaid === "boolean") {
      data.isPaid = body.isPaid;
      data.paidAt = body.isPaid ? new Date() : null;
    }
    if (typeof body.amount === "number") data.amount = body.amount;
    if (typeof body.note === "string") data.note = body.note;

    await db.hrPaymentEvent.update({ where: { id: body.id }, data });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as { id: number; deleteAll?: boolean };
    if (body.deleteAll) {
      // Delete recurring template + all its paid instances
      await db.hrPaymentEvent.deleteMany({ where: { note: { startsWith: `recurring:${body.id}` } } });
    }
    await db.hrPaymentEvent.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
