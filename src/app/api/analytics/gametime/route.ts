import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["OWNER", "CASHIER"].includes(session.user.role)) {
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

  const orderItems = await db.orderItem.findMany({
    where: {
      order: { status: "SERVED", createdAt: { gte: start, lt: end } },
      menuItem: { category: "gametime" },
    },
    select: {
      menuItemId: true,
      quantity: true,
      unitPriceTHB: true,
      menuItem: { select: { nameTh: true } },
    },
  });

  const map = new Map<number, { nameTh: string; qty: number; total: number }>();
  for (const item of orderItems) {
    const cur = map.get(item.menuItemId) ?? { nameTh: item.menuItem.nameTh, qty: 0, total: 0 };
    cur.qty += item.quantity;
    cur.total += item.quantity * item.unitPriceTHB;
    map.set(item.menuItemId, cur);
  }

  const items = [...map.entries()]
    .map(([menuItemId, v]) => ({ menuItemId, ...v }))
    .sort((a, b) => b.qty - a.qty);

  return NextResponse.json({ items });
}
