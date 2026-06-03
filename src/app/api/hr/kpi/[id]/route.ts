import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { actual, title, target, unit } = (await req.json()) as {
    actual?: number;
    title?: string;
    target?: number;
    unit?: string;
  };

  const kpi = await db.hrKpi.update({
    where: { id: Number(id) },
    data: {
      ...(actual !== undefined && { actual }),
      ...(title && { title }),
      ...(target !== undefined && { target }),
      ...(unit && { unit }),
    },
  });

  return NextResponse.json(kpi);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!["CASHIER", "OWNER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await db.hrKpi.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
