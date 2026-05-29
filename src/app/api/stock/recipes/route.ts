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
  if (!(await requireStaff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const menuItemId = searchParams.get("menuItemId");
  if (!menuItemId) return NextResponse.json({ error: "menuItemId จำเป็น" }, { status: 400 });

  const recipes = await db.menuStockRecipe.findMany({
    where: { menuItemId: Number(menuItemId) },
    include: { stockItem: { select: { id: true, name: true, unit: true, currentQty: true } } },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(recipes);
}

export async function POST(req: NextRequest) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { menuItemId, stockItemId, qtyUsed, size = "" } = await req.json() as {
    menuItemId: number; stockItemId: number; qtyUsed: number; size?: string;
  };

  if (!menuItemId || !stockItemId || !qtyUsed || qtyUsed <= 0)
    return NextResponse.json({ error: "menuItemId, stockItemId, qtyUsed จำเป็น" }, { status: 400 });

  const recipe = await db.menuStockRecipe.upsert({
    where: { menuItemId_stockItemId_size: { menuItemId, stockItemId, size } },
    create: { menuItemId, stockItemId, qtyUsed, size },
    update: { qtyUsed },
    include: { stockItem: { select: { id: true, name: true, unit: true, currentQty: true } } },
  });

  return NextResponse.json(recipe, { status: 201 });
}
