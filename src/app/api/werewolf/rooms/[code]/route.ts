import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

async function requireGM(code: string) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  const room = await db.werewolfRoom.findUnique({ where: { code } });
  if (!room || room.gmId !== Number(session.user.id)) return null;
  return { session, room };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: { _count: { select: { players: true } }, gm: { select: { username: true, firstName: true } } },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: room.id,
    code: room.code,
    isOpen: room.isOpen,
    playerCount: room._count.players,
    gmName: room.gm.firstName || room.gm.username,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const gm = await requireGM(code);
  if (!gm) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isOpen } = await req.json();
  const updated = await db.werewolfRoom.update({ where: { code }, data: { isOpen } });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const gm = await requireGM(code);
  if (!gm) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cascade: votes/actions → session players → session (break gameId FK) →
  //          game results → games → room players → room
  const session = await db.werewolfSession.findUnique({ where: { roomId: gm.room.id } });
  if (session) {
    await db.werewolfVote.deleteMany({ where: { sessionId: session.id } });
    await db.werewolfNightAction.deleteMany({ where: { sessionId: session.id } });
    await db.werewolfSessionPlayer.deleteMany({ where: { sessionId: session.id } });
    // Break the circular FK between session and game before deleting either
    if (session.gameId) {
      await db.werewolfSession.update({ where: { id: session.id }, data: { gameId: null } });
    }
    await db.werewolfSession.delete({ where: { id: session.id } });
  }
  const games = await db.werewolfGame.findMany({ where: { roomId: gm.room.id }, select: { id: true } });
  if (games.length) {
    await db.werewolfGameResult.deleteMany({ where: { gameId: { in: games.map((g) => g.id) } } });
    await db.werewolfGame.deleteMany({ where: { roomId: gm.room.id } });
  }
  await db.werewolfRoomPlayer.deleteMany({ where: { roomId: gm.room.id } });
  await db.werewolfRoom.delete({ where: { code } });

  return NextResponse.json({ ok: true });
}
