import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

async function requireOwner() {
  const session = await auth();
  return session?.user?.role === "OWNER" ? session : null;
}

async function requireStaff() {
  const session = await auth();
  return session?.user && ["STAFF", "CASHIER", "OWNER"].includes(session.user.role ?? "") ? session : null;
}

export async function GET() {
  if (!(await requireStaff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const templates = await db.hrChecklistTemplate.findMany({ orderBy: [{ type: "asc" }, { order: "asc" }] });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json() as { type: string; section?: string; label: string; order?: number; requiresPhoto?: boolean };
  if (!body.label?.trim() || !["OPEN", "CLOSE"].includes(body.type))
    return NextResponse.json({ error: "label และ type จำเป็น" }, { status: 400 });

  const maxOrder = await db.hrChecklistTemplate.aggregate({ where: { type: body.type }, _max: { order: true } });
  const template = await db.hrChecklistTemplate.create({
    data: {
      type: body.type,
      section: body.section?.trim() || null,
      label: body.label.trim(),
      order: body.order ?? (maxOrder._max.order ?? 0) + 1,
      requiresPhoto: body.requiresPhoto ?? false,
    },
  });
  return NextResponse.json(template, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json() as { id: number; section?: string; label?: string; order?: number; requiresPhoto?: boolean; isActive?: boolean };
  if (!body.id) return NextResponse.json({ error: "id จำเป็น" }, { status: 400 });

  const template = await db.hrChecklistTemplate.update({
    where: { id: body.id },
    data: {
      section: body.section !== undefined ? (body.section?.trim() || null) : undefined,
      label: body.label?.trim() || undefined,
      order: body.order ?? undefined,
      requiresPhoto: body.requiresPhoto ?? undefined,
      isActive: body.isActive ?? undefined,
    },
  });
  return NextResponse.json(template);
}

export async function DELETE(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id จำเป็น" }, { status: 400 });
  await db.hrChecklistTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
