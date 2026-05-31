import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const billId = Number(id);

  const sessions = await db.playerSession.findMany({
    where: { billId, status: "ACTIVE" },
    select: { id: true, nickname: true, userId: true, user: { select: { memberCode: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    sessions.map((s) => ({ id: s.id, nickname: s.nickname, userId: s.userId, memberCode: s.user?.memberCode ?? null }))
  );
}

type PlayerInput = { nameOrCode?: string };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const billId = Number(id);
  const { players } = (await req.json()) as { players: PlayerInput[] };

  const bill = await db.bill.findUnique({ where: { id: billId } });
  if (!bill || bill.status !== "ACTIVE") {
    return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });
  }
  if (!Array.isArray(players) || players.length === 0) {
    return NextResponse.json({ error: "ต้องมีผู้เล่นอย่างน้อย 1 คน" }, { status: 400 });
  }

  const existingCount = await db.playerSession.count({ where: { billId } });

  const createdSessions: { id: number; nickname: string }[] = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const raw = p.nameOrCode?.trim() ?? "";
    let userId: number | null = null;
    let nickname = raw || `Player ${existingCount + i + 1}`;

    if (raw) {
      const member = await db.user.findUnique({
        where: { memberCode: raw.toUpperCase() },
        select: { id: true, username: true },
      });
      if (member) {
        userId = member.id;
        nickname = member.username;
      }
    }

    const created = await db.playerSession.create({
      data: {
        tableId: bill.tableId,
        billId,
        nickname,
        packageType: "MANUAL",
        packagePrice: 0,
        timeRemaining: 0,
        userId,
      },
    });
    createdSessions.push({ id: created.id, nickname });
  }

  return NextResponse.json({ sessions: createdSessions });
}
