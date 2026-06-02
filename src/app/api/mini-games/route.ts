import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || !["STAFF", "OWNER", "CASHIER"].includes(session.user.role ?? "")) return null;
  return session;
}

export async function GET(req: NextRequest) {
  const showAll = new URL(req.url).searchParams.get("all") === "1";
  if (showAll) {
    const s = await requireAdmin();
    if (!s) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const games = await db.miniGame.findMany({
    where: showAll ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(games);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const data = await req.json();
  const game = await db.miniGame.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      htmlUrl: data.htmlUrl,
      coverUrl: data.coverUrl ?? null,
      isActive: data.isActive ?? true,
      sortOrder: Number(data.sortOrder) || 0,
    },
  });
  return NextResponse.json(game, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { id, ...data } = await req.json();
  const game = await db.miniGame.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.htmlUrl !== undefined && { htmlUrl: data.htmlUrl }),
      ...(data.coverUrl !== undefined && { coverUrl: data.coverUrl }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: Number(data.sortOrder) }),
      updatedAt: new Date(),
    },
  });
  return NextResponse.json(game);
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { id } = await req.json();
  await db.miniGame.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
