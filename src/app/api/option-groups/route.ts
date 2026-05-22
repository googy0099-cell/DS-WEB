import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

export async function GET() {
  const groups = await db.optionGroup.findMany({
    orderBy: { id: "asc" },
    include: { choices: { orderBy: { id: "asc" } } },
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const body = await req.json();

  if (body.action === "create-group") {
    const group = await db.optionGroup.create({
      data: { nameTh: body.nameTh, isRequired: body.isRequired ?? false },
    });
    return NextResponse.json(group, { status: 201 });
  }
  if (body.action === "add-choice") {
    const choice = await db.optionChoice.create({
      data: {
        optionGroupId: body.optionGroupId,
        nameTh: body.nameTh,
        priceTHB: body.priceTHB ?? 0,
        isDefault: body.isDefault ?? false,
      },
    });
    return NextResponse.json(choice, { status: 201 });
  }
  return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const body = await req.json();

  if (body.action === "update-group") {
    const { id, ...data } = body;
    const group = await db.optionGroup.update({ where: { id }, data });
    return NextResponse.json(group);
  }
  if (body.action === "update-choice") {
    const { id, ...data } = body;
    const choice = await db.optionChoice.update({ where: { id }, data });
    return NextResponse.json(choice);
  }
  return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const body = await req.json();

  if (body.action === "delete-group") {
    await db.menuItemOptionGroup.deleteMany({ where: { optionGroupId: body.id } });
    await db.optionChoice.deleteMany({ where: { optionGroupId: body.id } });
    await db.optionGroup.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "delete-choice") {
    await db.optionChoice.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
}
