import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

function syncedRemaining(timeRemaining: number, updatedAt: Date): number {
  const elapsedSec = Math.floor((Date.now() - updatedAt.getTime()) / 1000);
  return Math.max(0, timeRemaining - elapsedSec);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;

  const table = await db.table.findUnique({
    where: { id: Number(tableId) },
    include: {
      playerSessions: {
        where: { status: "ACTIVE" },
        include: {
          orders: {
            include: {
              items: {
                include: { menuItem: { select: { nameTh: true, priceTHB: true, priceS: true, category: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!table) return NextResponse.json({ error: "ไม่พบโต๊ะ" }, { status: 404 });

  const sessions = table.playerSessions.map((s) => ({
    ...s,
    timeRemaining: syncedRemaining(s.timeRemaining, s.updatedAt),
    totalSpent: s.orders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((sum, o) => sum + o.totalTHB, 0),
  }));

  return NextResponse.json({ ...table, playerSessions: sessions });
}
