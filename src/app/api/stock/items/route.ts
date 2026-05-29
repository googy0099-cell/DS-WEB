import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

async function requireStaff() {
  const session = await auth();
  if (!session?.user || !["STAFF", "CASHIER", "OWNER"].includes(session.user.role ?? ""))
    return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const lowOnly = searchParams.get("low") === "1";

  const items = await db.stockItem.findMany({
    where: lowOnly
      ? { isActive: true }
      : {},
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  const filtered = lowOnly
    ? items.filter((i) => i.currentQty < i.minQty)
    : items;

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    sku: string; name: string; unit: string;
    minQty?: number; reorderQty?: number; costPerUnit?: number;
  };

  if (!body.sku?.trim() || !body.name?.trim() || !body.unit?.trim())
    return NextResponse.json({ error: "sku, name, unit จำเป็น" }, { status: 400 });

  const item = await db.stockItem.create({
    data: {
      sku: body.sku.trim().toUpperCase(),
      name: body.name.trim(),
      unit: body.unit.trim(),
      minQty: body.minQty ?? 0,
      reorderQty: body.reorderQty ?? 0,
      costPerUnit: body.costPerUnit ?? 0,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
