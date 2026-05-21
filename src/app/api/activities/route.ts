import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  const session = all ? await auth() : null;
  const isAdmin = session?.user && (session.user.role === "STAFF" || session.user.role === "OWNER");
  const items = await db.activity.findMany({
    where: isAdmin ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "desc" }],
  });
  return NextResponse.json(items);
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const data = await req.json();
  const item = await db.activity.create({ data });
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { id, ...data } = await req.json();
  const item = await db.activity.update({ where: { id }, data });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { id } = await req.json();
  await db.activity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
