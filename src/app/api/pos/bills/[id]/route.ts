import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { remainingSeconds } from "@/lib/pos-time";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const billId = Number(id);
  const body = (await req.json()) as { tableId?: number; status?: string };

  const bill = await db.bill.findUnique({
    where: { id: billId },
    include: { sessions: { where: { status: "ACTIVE" } } },
  });
  if (!bill) return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });

  // Change table → update bill + all its active sessions (table is just a label)
  if (body.tableId !== undefined) {
    await db.bill.update({ where: { id: billId }, data: { tableId: body.tableId } });
    await db.playerSession.updateMany({ where: { billId }, data: { tableId: body.tableId } });
    await db.table.update({ where: { id: body.tableId }, data: { isOccupied: true } });
  }

  // Close bill → close all sessions, credit member hours, free table
  if (body.status === "CLOSED") {
    const now = Date.now();
    for (const s of bill.sessions) {
      const played = remainingSeconds(s.timeRemaining, bill.startsAt, s.updatedAt, now);
      const usedSeconds = s.timeRemaining - played;
      if (s.userId && usedSeconds > 0) {
        await db.user.update({
          where: { id: s.userId },
          data: { playMinutes: { increment: Math.round(usedSeconds / 60) } },
        });
      }
    }
    await db.playerSession.updateMany({ where: { billId }, data: { status: "PAID" } });
    await db.bill.update({ where: { id: billId }, data: { status: "CLOSED" } });

    // Free the (current) table if no other active bill on it
    const others = await db.bill.count({
      where: { tableId: bill.tableId, status: "ACTIVE", id: { not: billId } },
    });
    if (others === 0) {
      await db.table.update({ where: { id: bill.tableId }, data: { isOccupied: false } });
    }
  }

  return NextResponse.json({ ok: true });
}
