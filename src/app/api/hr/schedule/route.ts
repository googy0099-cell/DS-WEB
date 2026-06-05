import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const staff = await db.hrStaff.findMany({
      include: {
        user: { select: { firstName: true, lastName: true } },
        schedules: { orderBy: { dayOfWeek: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      staff.map((s) => ({
        id: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`.trim(),
        schedules: s.schedules.map((sc) => ({
          dayOfWeek: sc.dayOfWeek,
          startTime: sc.startTime,
          endTime: sc.endTime,
          graceMinutes: sc.graceMinutes,
        })),
      }))
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { staffId, dayOfWeek, startTime, endTime, graceMinutes } =
    (await req.json()) as {
      staffId: number;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      graceMinutes?: number;
    };

  if (
    !staffId ||
    dayOfWeek < 0 ||
    dayOfWeek > 6 ||
    !/^\d{2}:\d{2}$/.test(startTime) ||
    !/^\d{2}:\d{2}$/.test(endTime)
  ) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const grace = graceMinutes ?? 10;

  try {
    const upserted = await db.hrSchedule.upsert({
      where: { staffId_dayOfWeek: { staffId, dayOfWeek } },
      update: { startTime, endTime, graceMinutes: grace },
      create: { staffId, dayOfWeek, startTime, endTime, graceMinutes: grace },
    });
    return NextResponse.json(upserted);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { staffId, dayOfWeek } = (await req.json()) as {
    staffId: number;
    dayOfWeek: number;
  };

  await db.hrSchedule.delete({
    where: { staffId_dayOfWeek: { staffId, dayOfWeek } },
  });

  return NextResponse.json({ ok: true });
}
