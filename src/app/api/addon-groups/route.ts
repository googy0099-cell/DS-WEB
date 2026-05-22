import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

export async function GET() {
  const groups = await db.addonGroup.findMany({
    orderBy: { id: "asc" },
    include: { items: { orderBy: { id: "asc" } } },
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const body = await req.json();

  // POST group
  if (body.action === "create-group") {
    const group = await db.addonGroup.create({ data: { nameTh: body.nameTh } });
    return NextResponse.json(group, { status: 201 });
  }
  // POST item to group
  if (body.action === "add-item") {
    const item = await db.addonItem.create({
      data: { addonGroupId: body.addonGroupId, nameTh: body.nameTh, priceTHB: body.priceTHB },
    });
    return NextResponse.json(item, { status: 201 });
  }
  return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const body = await req.json();

  if (body.action === "update-group") {
    const { id, ...data } = body;
    const group = await db.addonGroup.update({ where: { id }, data });
    return NextResponse.json(group);
  }
  if (body.action === "update-item") {
    const { id, ...data } = body;
    const item = await db.addonItem.update({ where: { id }, data });
    return NextResponse.json(item);
  }
  return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const body = await req.json();

  if (body.action === "delete-group") {
    await db.menuItemAddonGroup.deleteMany({ where: { addonGroupId: body.id } });
    await db.addonItem.deleteMany({ where: { addonGroupId: body.id } });
    await db.addonGroup.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "delete-item") {
    await db.addonItem.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
}
