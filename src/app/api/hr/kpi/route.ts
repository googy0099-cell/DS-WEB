import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const role = (session.user as { role?: string }).role;
  const month = Number(req.nextUrl.searchParams.get("month") ?? new Date().getMonth() + 1);
  const year = Number(req.nextUrl.searchParams.get("year") ?? new Date().getFullYear());

  const hrStaff = await db.hrStaff.findUnique({ where: { userId } });

  const kpis = await db.hrKpi.findMany({
    where: {
      month,
      year,
      ...(role === "STAFF" && hrStaff ? { staffId: hrStaff.id } : {}),
    },
    include: {
      staff: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: [{ staffId: "asc" }, { id: "asc" }],
  });

  return NextResponse.json(kpis);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!["CASHIER", "OWNER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { staffId, title, target, unit, month, year } = (await req.json()) as {
    staffId: number;
    title: string;
    target: number;
    unit: string;
    month: number;
    year: number;
  };

  if (!staffId || !title || !target || !unit || !month || !year) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const kpi = await db.hrKpi.create({
    data: { staffId, title, target, unit, month, year },
    include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });

  return NextResponse.json(kpi, { status: 201 });
}
