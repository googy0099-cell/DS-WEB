import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

function ownerOnly(session: Awaited<ReturnType<typeof auth>>) {
  return (session?.user as { role?: string })?.role !== "OWNER";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (ownerOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const now = new Date(Date.now() + 7 * 3600_000);
  const year = Number(url.searchParams.get("year") ?? now.getUTCFullYear());
  const month = Number(url.searchParams.get("month") ?? now.getUTCMonth() + 1);

  const start = new Date(Date.UTC(year, month - 1, 1) - 7 * 3600_000);
  const end = new Date(Date.UTC(year, month, 1) - 7 * 3600_000);

  try {
    const events = await db.hrPaymentEvent.findMany({
      where: { date: { gte: start, lt: end } },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(events.map((e) => ({
      id: e.id,
      staffId: e.staffId,
      staffName: e.staff ? `${e.staff.user.firstName} ${e.staff.user.lastName}`.trim() : null,
      date: e.date.toISOString().slice(0, 10),
      amount: e.amount,
      description: e.description,
      type: e.type,
      isPaid: e.isPaid,
      paidAt: e.paidAt?.toISOString() ?? null,
      note: e.note,
    })));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (ownerOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as {
      staffId?: number | null;
      date: string;
      amount: number;
      description: string;
      type?: string;
      note?: string;
    };

    if (!body.date || !body.amount || !body.description) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    const event = await db.hrPaymentEvent.create({
      data: {
        staffId: body.staffId ?? null,
        date: new Date(`${body.date}T00:00:00+07:00`),
        amount: body.amount,
        description: body.description,
        type: body.type ?? "SALARY",
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
  if (ownerOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as { id: number; isPaid?: boolean; amount?: number; note?: string };
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
  if (ownerOnly(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await req.json() as { id: number };
    await db.hrPaymentEvent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
