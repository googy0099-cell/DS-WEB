import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  const section = req.nextUrl.searchParams.get("section");
  const session = all ? await auth() : null;
  const isAdmin = session?.user && ["STAFF", "CASHIER", "OWNER"].includes(session.user.role ?? "");
  const items = await db.galleryItem.findMany({
    where: {
      ...(isAdmin ? {} : { isActive: true }),
      ...(section ? { section } : {}),
    },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(items);
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || !["STAFF", "CASHIER", "OWNER"].includes(session.user.role ?? "")) return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const data = await req.json();
  const item = await db.galleryItem.create({ data });
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { id, ...data } = await req.json();
  const item = await db.galleryItem.update({ where: { id }, data });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { id } = await req.json();
  await db.galleryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
