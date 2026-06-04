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
  const section = searchParams.get("section");
  const type = searchParams.get("type");

  if (section !== null && type) {
    // Delete all items in a section
    await db.hrChecklistTemplate.deleteMany({
      where: { type, section: section === "" ? null : section },
    });
    return NextResponse.json({ ok: true });
  }

  if (!id) return NextResponse.json({ error: "id จำเป็น" }, { status: 400 });
  await db.hrChecklistTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// PUT — rename a section OR bulk reorder items
export async function PUT(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json() as
    | { type: string; oldSection: string | null; newSection: string | null }
    | { items: { id: number; order: number }[] };

  if ("items" in body) {
    await Promise.all(
      body.items.map((item) =>
        db.hrChecklistTemplate.update({ where: { id: item.id }, data: { order: item.order } })
      )
    );
    return NextResponse.json({ ok: true });
  }

  await db.hrChecklistTemplate.updateMany({
    where: { type: body.type, section: body.oldSection },
    data: { section: body.newSection },
  });
  return NextResponse.json({ ok: true });
}
