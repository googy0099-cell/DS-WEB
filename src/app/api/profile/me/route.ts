import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { remainingSeconds, prepRemaining } from "@/lib/pos-time";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.user.id);
  const [user, activeSessions] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      include: {
        orders: {
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, status: true, totalTHB: true, createdAt: true },
        },
      },
    }),
    db.playerSession.findMany({
      where: { userId, status: "ACTIVE" },
      include: { bill: { select: { startsAt: true, name: true } }, table: { select: { number: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const sessions = activeSessions.map((s) => ({
    id: s.id,
    nickname: s.nickname,
    packageType: s.packageType,
    tableNumber: s.table.number,
    billName: s.bill?.name ?? null,
    prepRemaining: s.bill ? prepRemaining(s.bill.startsAt, now) : 0,
    timeRemaining: s.bill
      ? remainingSeconds(s.timeRemaining, s.bill.startsAt, s.updatedAt, now)
      : s.timeRemaining,
  }));

  return NextResponse.json({ ...user, activeSessions: sessions });
}
