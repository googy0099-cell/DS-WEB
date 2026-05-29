import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

async function requireStaff() {
  const session = await auth();
  if (!session?.user || !["STAFF", "CASHIER", "OWNER"].includes(session.user.role ?? ""))
    return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as Partial<{
    sku: string; name: string; unit: string;
    minQty: number; reorderQty: number; costPerUnit: number; isActive: boolean;
  }>;

  const item = await db.stockItem.update({
    where: { id: Number(id) },
    data: {
      ...(body.sku !== undefined ? { sku: body.sku.trim().toUpperCase() } : {}),
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.unit !== undefined ? { unit: body.unit.trim() } : {}),
      ...(body.minQty !== undefined ? { minQty: body.minQty } : {}),
      ...(body.reorderQty !== undefined ? { reorderQty: body.reorderQty } : {}),
      ...(body.costPerUnit !== undefined ? { costPerUnit: body.costPerUnit } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.stockItem.update({ where: { id: Number(id) }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
