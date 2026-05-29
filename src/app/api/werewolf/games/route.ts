import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER" && session.user.role !== "CASHIER")) return null;
  return session;
}

export async function POST(req: NextRequest) {
  const session = await requireGM();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roomId, code, winTeam, notes, results } = await req.json();

  if (!winTeam || !results?.length)
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  let resolvedRoomId = roomId ? Number(roomId) : undefined;
  if (!resolvedRoomId && code) {
    const room = await db.werewolfRoom.findUnique({ where: { code } });
    if (!room) return NextResponse.json({ error: "ไม่พบห้อง" }, { status: 404 });
    resolvedRoomId = room.id;
  }
  if (!resolvedRoomId) return NextResponse.json({ error: "ต้องระบุ roomId หรือ code" }, { status: 400 });

  const game = await db.werewolfGame.create({
    data: {
      roomId: resolvedRoomId,
      gmId: Number(session.user.id),
      winTeam,
      notes: notes || null,
      results: {
        create: results.map((r: { userId: number; team: string; role: string; isWin: boolean }) => ({
          userId: Number(r.userId),
          team: r.team,
          role: r.role,
          isWin: r.isWin,
        })),
      },
    },
    include: { results: true },
  });

  return NextResponse.json(game);
}

export async function GET(req: NextRequest) {
  const session = await requireGM();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId");

  const games = await db.werewolfGame.findMany({
    where: roomId ? { roomId: Number(roomId) } : { gmId: Number(session.user.id) },
    orderBy: { playedAt: "desc" },
    take: 50,
    include: { results: { include: { user: { select: { firstName: true, nickname: true } } } } },
  });

  return NextResponse.json(games);
}
