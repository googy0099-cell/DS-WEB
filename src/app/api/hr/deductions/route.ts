import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { staffId, amount, reason, note, month, year } = (await req.json()) as {
    staffId: number;
    amount: number;
    reason: string;
    note?: string;
    month: number;
    year: number;
  };

  if (!staffId || !amount || amount <= 0 || !reason || !month || !year) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "เดือนไม่ถูกต้อง" }, { status: 400 });
  }

  const created = await db.hrDeduction.create({
    data: { staffId, amount, reason, note: note ?? null, month, year },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = (await req.json()) as { id: number };
  if (!id) return NextResponse.json({ error: "ไม่มี id" }, { status: 400 });

  await db.hrDeduction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
