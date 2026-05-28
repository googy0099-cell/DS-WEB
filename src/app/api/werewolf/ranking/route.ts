import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "all";

  let dateFilter: Date | undefined;
  const now = new Date();
  if (period === "week") dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  else if (period === "month") dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);

  const periodWhere = dateFilter ? { game: { playedAt: { gte: dateFilter } } } : undefined;

  const [totals, wins] = await Promise.all([
    db.werewolfGameResult.groupBy({
      by: ["userId"],
      where: periodWhere,
      _count: { _all: true },
    }),
    db.werewolfGameResult.groupBy({
      by: ["userId"],
      where: { ...periodWhere, isWin: true },
      _count: { _all: true },
    }),
  ]);

  if (!totals.length) return NextResponse.json([]);

  const winMap = new Map(wins.map((w) => [w.userId, w._count._all]));
  const userIds = totals.map((t) => t.userId);

  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nickname: true, firstName: true, avatarUrl: true, googleId: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const result = totals
    .map((t) => {
      const u = userMap.get(t.userId);
      const total = t._count._all;
      const w = winMap.get(t.userId) ?? 0;
      return {
        userId: t.userId,
        name: u?.nickname || u?.firstName || `User ${t.userId}`,
        total,
        wins: w,
        losses: total - w,
        winRate: total > 0 ? Math.round((w / total) * 100) : 0,
        avatarUrl: u?.avatarUrl ?? null,
        googleId: u?.googleId ?? null,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)
    .slice(0, 20);

  return NextResponse.json(result);
}
