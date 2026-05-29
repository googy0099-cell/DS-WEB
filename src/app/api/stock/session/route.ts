import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

async function requireStaff() {
  const session = await auth();
  if (!session?.user || !["STAFF", "CASHIER", "OWNER"].includes(session.user.role ?? ""))
    return null;
  return session;
}

const EMPTY_SESSION = { id: 1, isOpen: false, openedAt: null, closedAt: null, openedById: null };

export async function GET(req: NextRequest) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const check = searchParams.get("check");

  const shopSession = await db.shopSession.findUnique({ where: { id: 1 } }) ?? EMPTY_SESSION;

  // Pre-open check: menus with insufficient stock (< 1 serving)
  if (check === "preopen") {
    const recipes = await db.menuStockRecipe.findMany({
      where: { menuItem: { isAvailable: true } },
      include: {
        stockItem: true,
        menuItem: { select: { id: true, nameTh: true } },
      },
    });

    const menuMap = new Map<number, { id: number; nameTh: string; missing: string[] }>();
    for (const r of recipes) {
      if (r.stockItem.currentQty >= r.qtyUsed) continue;
      if (!menuMap.has(r.menuItemId))
        menuMap.set(r.menuItemId, { id: r.menuItemId, nameTh: r.menuItem.nameTh, missing: [] });
      menuMap.get(r.menuItemId)!.missing.push(
        `${r.stockItem.name}: เหลือ ${r.stockItem.currentQty}/${r.qtyUsed} ${r.stockItem.unit}`
      );
    }
    return NextResponse.json({ shopSession, lowMenus: Array.from(menuMap.values()) });
  }

  // Pre-close check: items at or below reorder level
  if (check === "preclose") {
    const allItems = await db.stockItem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    const needReorder = allItems.filter((i) => i.reorderQty > 0 && i.currentQty <= i.reorderQty);
    return NextResponse.json({ shopSession, needReorder });
  }

  return NextResponse.json(shopSession);
}

export async function POST(req: NextRequest) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json() as { action: "open" | "close" };
  const userId = Number(session.user.id);

  if (action === "open") {
    const s = await db.shopSession.upsert({
      where: { id: 1 },
      create: { id: 1, isOpen: true, openedAt: new Date(), openedById: userId },
      update: { isOpen: true, openedAt: new Date(), closedAt: null, openedById: userId },
    });
    return NextResponse.json(s);
  }

  if (action === "close") {
    const s = await db.shopSession.upsert({
      where: { id: 1 },
      create: { id: 1, isOpen: false, closedAt: new Date() },
      update: { isOpen: false, closedAt: new Date() },
    });
    return NextResponse.json(s);
  }

  return NextResponse.json({ error: "action ต้องเป็น open หรือ close" }, { status: 400 });
}
