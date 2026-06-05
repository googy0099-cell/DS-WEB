import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { remainingSeconds } from "@/lib/pos-time";
import { notifyBillClosed } from "@/lib/telegram-notify";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const billId = Number(id);
  const body = (await req.json()) as { tableId?: number; status?: string; name?: string; color?: string; setTimeAll?: number; addTimeAll?: number };

  try {
  const bill = await db.bill.findUnique({
    where: { id: billId },
    select: {
      id: true, status: true, tableId: true, startsAt: true,
      sessions: {
        where: { status: "ACTIVE" },
        select: { id: true, userId: true, timeRemaining: true, updatedAt: true },
      },
    },
  });
  if (!bill) return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });

  // Rename bill
  if (body.name !== undefined) {
    await db.bill.update({ where: { id: billId }, data: { name: body.name.trim() }, select: { id: true } });
  }

  // Change bill color
  if (body.color !== undefined) {
    await db.bill.update({ where: { id: billId }, data: { color: body.color }, select: { id: true } });
  }

  // Change table → snapshot each session's remaining time before writing (updateMany bumps updatedAt)
  if (body.tableId !== undefined) {
    await db.bill.update({ where: { id: billId }, data: { tableId: body.tableId }, select: { id: true } });
    const now = Date.now();
    for (const s of bill.sessions) {
      const current = remainingSeconds(s.timeRemaining, bill.startsAt, s.updatedAt, now);
      await db.playerSession.update({
        where: { id: s.id },
        data: { tableId: body.tableId, timeRemaining: current },
      });
    }
    await db.table.update({ where: { id: body.tableId }, data: { isOccupied: true } });
  }

  // Set time for all active sessions (staff manual override)
  if (body.setTimeAll !== undefined) {
    await db.playerSession.updateMany({
      where: { billId, status: "ACTIVE" },
      data: { timeRemaining: body.setTimeAll },
    });
  }

  // Add/subtract time for all active sessions individually
  if (body.addTimeAll !== undefined) {
    const now = Date.now();
    for (const s of bill.sessions) {
      const current = remainingSeconds(s.timeRemaining, bill.startsAt, s.updatedAt, now);
      await db.playerSession.update({
        where: { id: s.id },
        data: { timeRemaining: Math.max(0, current + body.addTimeAll) },
      });
    }
  }

  // Close bill → close all sessions, credit member hours, free table
  if (body.status === "CLOSED") {
    if (bill.status === "CLOSED") return NextResponse.json({ ok: true });
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
    await db.bill.update({ where: { id: billId }, data: { status: "CLOSED" }, select: { id: true } });

    // Free the (current) table if no other active bill on it
    const others = await db.bill.count({
      where: { tableId: bill.tableId, status: "ACTIVE", id: { not: billId } },
    });
    if (others === 0) {
      await db.table.update({ where: { id: bill.tableId }, data: { isOccupied: false } });
    }

    // Telegram notification (fire-and-forget)
    db.bill.findUnique({
      where: { id: billId },
      select: {
        name: true,
        table: { select: { number: true } },
        sessions: { where: { status: "PAID" }, select: { packageType: true, packagePrice: true, status: true } },
        orders: { where: { status: "SERVED" }, select: { totalTHB: true, payment: { select: { method: true } } } },
      },
    }).then((b) => {
      if (!b) return;
      const activeSessions = b.sessions.filter((s) => s.status === "PAID");
      const pkgMap: Record<string, number> = {};
      for (const s of activeSessions) pkgMap[s.packageType] = (pkgMap[s.packageType] ?? 0) + 1;
      const packages = Object.entries(pkgMap).map(([k, n]) => `${k}×${n}`).join(", ") || "—";
      const gameRevenue = activeSessions.reduce((sum, s) => sum + s.packagePrice, 0);
      const foodRevenue = b.orders.reduce((sum, o) => sum + o.totalTHB, 0);
      const methods = [...new Set(b.orders.flatMap((o) => o.payment ? [o.payment.method] : []))];
      const paymentMethod = methods[0] ?? "—";
      notifyBillClosed({
        billName: b.name,
        tableNumber: b.table.number,
        playerCount: activeSessions.length,
        packages,
        gameRevenue,
        foodRevenue,
        total: gameRevenue + foodRevenue,
        paymentMethod,
      });
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PATCH /api/pos/bills]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
