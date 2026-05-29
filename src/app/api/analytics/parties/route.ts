import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

function bkkDateKey(utcDate: Date): string {
  return new Date(utcDate.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

function bkkDateTime(utcDate: Date): string {
  return new Date(utcDate.getTime() + 7 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
}

const PKG_LABEL: Record<string, string> = { A: "A", B: "B", C: "C (เหมาวัน)", D: "D (อัพเกรด)" };

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

  const bills = await db.bill.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: {
      table: { select: { number: true } },
      sessions: {
        select: { id: true, nickname: true, packageType: true, packagePrice: true, status: true, userId: true, user: { select: { firstName: true, memberCode: true } } },
      },
      orders: {
        where: { status: "SERVED" },
        select: { totalTHB: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const parties = bills.map((b) => {
    const activeSessions = b.sessions.filter((s) => s.status !== "LEFT");
    const playerCount = activeSessions.length;
    const memberCount = activeSessions.filter((s) => s.userId !== null).length;

    // Package summary e.g. "A×2, B×1"
    const pkgMap: Record<string, number> = {};
    for (const s of activeSessions) pkgMap[s.packageType] = (pkgMap[s.packageType] ?? 0) + 1;
    const pkgSummary = Object.entries(pkgMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, n]) => `${PKG_LABEL[k] ?? k}×${n}`)
      .join(", ");

    const gameRevenue = activeSessions.reduce((s, p) => s + p.packagePrice, 0);
    const foodRevenue = b.orders.reduce((s, o) => s + o.totalTHB, 0);
    const totalRevenue = gameRevenue + foodRevenue;

    const players = activeSessions.map((s) => ({
      nickname: s.nickname,
      packageType: s.packageType,
      packagePrice: s.packagePrice,
      memberName: s.user?.firstName ?? null,
      memberCode: s.user?.memberCode ?? null,
    }));

    return {
      id: b.id,
      name: b.name,
      tableNumber: b.table.number,
      status: b.status,
      date: bkkDateKey(b.createdAt),
      openedAt: bkkDateTime(b.createdAt),
      playerCount,
      memberCount,
      pkgSummary,
      gameRevenue,
      foodRevenue,
      totalRevenue,
      players,
    };
  });

  const totalParties = parties.length;
  const totalPlayers = parties.reduce((s, p) => s + p.playerCount, 0);
  const totalRevenue = parties.reduce((s, p) => s + p.totalRevenue, 0);
  const totalGameRevenue = parties.reduce((s, p) => s + p.gameRevenue, 0);
  const totalFoodRevenue = parties.reduce((s, p) => s + p.foodRevenue, 0);
  const avgPlayers = totalParties > 0 ? +(totalPlayers / totalParties).toFixed(1) : 0;
  const avgRevenue = totalParties > 0 ? Math.round(totalRevenue / totalParties) : 0;

  return NextResponse.json({ parties, totalParties, totalPlayers, totalRevenue, totalGameRevenue, totalFoodRevenue, avgPlayers, avgRevenue });
}
