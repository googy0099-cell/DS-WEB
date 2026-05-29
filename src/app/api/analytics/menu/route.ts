import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const from = searchParams.get("from") || today;
  const to = searchParams.get("to") || today;

  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = new Date(Date.UTC(fy, fm - 1, fd, -7, 0, 0));
  const end = new Date(Date.UTC(ty, tm - 1, td + 1, -7, 0, 0));

  const grouped = await db.orderItem.groupBy({
    by: ["menuItemId"],
    where: { order: { status: "SERVED", createdAt: { gte: start, lt: end } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
  });

  const menuIds = grouped.map((g) => g.menuItemId);
  const menuItems = await db.menuItem.findMany({
    where: { id: { in: menuIds } },
    select: { id: true, nameTh: true, priceTHB: true },
  });

  const items = grouped.map((g) => {
    const mi = menuItems.find((m) => m.id === g.menuItemId);
    const qty = g._sum.quantity ?? 0;
    const total = qty * (mi?.priceTHB ?? 0);
    return { menuItemId: g.menuItemId, nameTh: mi?.nameTh ?? "-", qty, total };
  });

  return NextResponse.json({ items });
}
