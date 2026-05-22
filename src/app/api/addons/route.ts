import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const addons = await db.addon.findMany({
    where: all ? undefined : { isActive: true },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(addons);
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) {
    return null;
  }
  return session;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { nameTh, priceTHB } = await req.json();
  const addon = await db.addon.create({ data: { nameTh, priceTHB } });
  return NextResponse.json(addon, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { id, ...data } = await req.json();
  const addon = await db.addon.update({ where: { id }, data });
  return NextResponse.json(addon);
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { id } = await req.json();
  await db.addon.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
