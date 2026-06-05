import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!["OWNER", "CASHIER"].includes(session?.user?.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json() as { nameTh?: string; type?: string; value?: number; isActive?: boolean };
  const d = await db.discount.update({
    where: { id: Number(id) },
    data: {
      ...(body.nameTh !== undefined ? { nameTh: body.nameTh.trim() } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.value !== undefined ? { value: body.value } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });
  return NextResponse.json(d);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!["OWNER", "CASHIER"].includes(session?.user?.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db.discount.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
