import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

function syncedRemaining(timeRemaining: number, updatedAt: Date): number {
  const elapsedSec = Math.floor((Date.now() - updatedAt.getTime()) / 1000);
  return Math.max(0, timeRemaining - elapsedSec);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await db.playerSession.findUnique({
    where: { id: Number(id) },
    include: {
      table: { select: { number: true } },
      orders: {
        include: {
          items: {
            include: { menuItem: { select: { nameTh: true, priceTHB: true, priceS: true, category: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!session) return NextResponse.json({ error: "ไม่พบ Session" }, { status: 404 });

  return NextResponse.json({
    ...session,
    timeRemaining: syncedRemaining(session.timeRemaining, session.updatedAt),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as { status?: string; addSeconds?: number };

  const session = await db.playerSession.findUnique({ where: { id: Number(id) } });
  if (!session) return NextResponse.json({ error: "ไม่พบ Session" }, { status: 404 });

  const current = syncedRemaining(session.timeRemaining, session.updatedAt);

  const updated = await db.playerSession.update({
    where: { id: Number(id) },
    data: {
      ...(body.status ? { status: body.status } : {}),
      timeRemaining: body.addSeconds !== undefined ? current + body.addSeconds : current,
    },
  });

  if (body.status === "PAID" || body.status === "LEFT") {
    const remaining = await db.playerSession.count({
      where: { tableId: session.tableId, status: "ACTIVE", id: { not: Number(id) } },
    });
    if (remaining === 0) {
      await db.table.update({ where: { id: session.tableId }, data: { isOccupied: false } });
    }
  }

  return NextResponse.json(updated);
}
