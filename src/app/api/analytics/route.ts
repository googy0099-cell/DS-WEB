import { NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayOrders, monthRevenue, totalMembers, newMembersMonth, topMenu] =
    await Promise.all([
      db.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      db.order.aggregate({
        where: { status: "SERVED", createdAt: { gte: monthStart } },
        _sum: { totalTHB: true },
      }),
      db.user.count({ where: { role: "USER" } }),
      db.user.count({
        where: { role: "USER", createdAt: { gte: monthStart } },
      }),
      db.orderItem.groupBy({
        by: ["menuItemId"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
    ]);

  const menuIds = topMenu.map((m) => m.menuItemId);
  const menuItems = await db.menuItem.findMany({ where: { id: { in: menuIds } } });

  const topMenuWithNames = topMenu.map((m) => ({
    menuItemId: m.menuItemId,
    nameTh: menuItems.find((mi) => mi.id === m.menuItemId)?.nameTh ?? "-",
    quantity: m._sum.quantity ?? 0,
  }));

  return NextResponse.json({
    todayOrders,
    monthRevenue: monthRevenue._sum.totalTHB ?? 0,
    totalMembers,
    newMembersMonth,
    topMenu: topMenuWithNames,
  });
}
