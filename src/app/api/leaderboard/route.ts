import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "all";

  let dateFilter: Date | undefined;
  const now = new Date();
  if (period === "week") {
    dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "month") {
    dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (!dateFilter) {
    const members = await db.user.findMany({
      where: { role: "USER" },
      orderBy: { points: "desc" },
      take: 20,
      select: { id: true, nickname: true, firstName: true, points: true, totalSpentTHB: true },
    });
    return NextResponse.json(
      members.map((m) => ({ ...m, nickname: m.nickname || m.firstName }))
    );
  }

  // Period-based: rank by spending in orders within the period
  const orderGroups = await db.order.groupBy({
    by: ["userId"],
    where: { userId: { not: null }, createdAt: { gte: dateFilter } },
    _sum: { totalTHB: true },
    orderBy: { _sum: { totalTHB: "desc" } },
    take: 20,
  });

  const userIds = orderGroups.map((g) => g.userId!);
  const users = await db.user.findMany({
    where: { id: { in: userIds }, role: "USER" },
    select: { id: true, nickname: true, firstName: true, points: true, totalSpentTHB: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));
  const result = orderGroups
    .filter((g) => userMap.has(g.userId!))
    .map((g) => {
      const u = userMap.get(g.userId!)!;
      return {
        id: u.id,
        nickname: u.nickname || u.firstName,
        points: u.points,
        totalSpentTHB: g._sum.totalTHB ?? 0,
      };
    });

  return NextResponse.json(result);
}
