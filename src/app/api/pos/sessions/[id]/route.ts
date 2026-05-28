import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { remainingSeconds } from "@/lib/pos-time";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { status?: string; addSeconds?: number; upgradeToAllDay?: boolean; addExtraSpend?: number };

  const session = await db.playerSession.findUnique({
    where: { id: Number(id) },
    include: { bill: true },
  });
  if (!session) return NextResponse.json({ error: "ไม่พบ Session" }, { status: 404 });

  const startsAt = session.bill?.startsAt ?? session.createdAt;
  const current = remainingSeconds(session.timeRemaining, startsAt, session.updatedAt);

  const updated = await db.playerSession.update({
    where: { id: Number(id) },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.upgradeToAllDay
        ? { packageType: "C", timeRemaining: 86400 }
        : { timeRemaining: body.addSeconds !== undefined ? current + body.addSeconds : current }
      ),
      ...(body.addExtraSpend && body.addExtraSpend > 0 ? { packagePrice: { increment: body.addExtraSpend } } : {}),
    },
  });

  if (body.status === "PAID" || body.status === "LEFT") {
    // Credit played time (purchased - remaining) to linked member
    if (session.userId && body.status === "PAID") {
      const usedSeconds = session.timeRemaining - current;
      const diceEarned = Math.floor(session.packagePrice / 49);
      await db.user.update({
        where: { id: session.userId },
        data: {
          ...(usedSeconds > 0 ? { playMinutes: { increment: Math.round(usedSeconds / 60) } } : {}),
          ...(diceEarned > 0 ? { dicePoints: { increment: diceEarned } } : {}),
        },
      });
    }

    // Free table if no other active session/bill on it
    const activeSessions = await db.playerSession.count({
      where: { tableId: session.tableId, status: "ACTIVE", id: { not: Number(id) } },
    });
    if (activeSessions === 0) {
      await db.table.update({ where: { id: session.tableId }, data: { isOccupied: false } });
    }
  }

  return NextResponse.json(updated);
}
