import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { getTeam } from "@/lib/werewolf-roles";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

function shuffle(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function POST(req: NextRequest) {
  const session = await requireGM();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const roomCode: string = body.roomCode;
  const selectedRoles: string[] = body.selectedRoles ?? [];
  const decoyRoles: string[] = body.decoyRoles ?? [];

  if (!roomCode || !selectedRoles.length)
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  const room = await db.werewolfRoom.findUnique({
    where: { code: roomCode },
    include: {
      players: {
        include: { user: { select: { id: true, firstName: true, nickname: true } } },
        orderBy: { seatOrder: "asc" },
      },
      session: { select: { id: true } },
    },
  });
  if (!room) return NextResponse.json({ error: "ไม่พบห้อง" }, { status: 404 });

  const players = room.players;
  if (players.length === 0) return NextResponse.json({ error: "ไม่มีผู้เล่น" }, { status: 400 });
  if (selectedRoles.length < players.length)
    return NextResponse.json({ error: "บทบาทไม่พอสำหรับผู้เล่น" }, { status: 400 });

  const shuffledRoles = shuffle(selectedRoles).slice(0, players.length);

  // Delete existing session — must clear ALL child tables first (nightActions, votes, players)
  if (room.session) {
    const sid = room.session.id;
    await db.$transaction([
      db.werewolfNightAction.deleteMany({ where: { sessionId: sid } }),
      db.werewolfVote.deleteMany({ where: { sessionId: sid } }),
      db.werewolfSessionPlayer.deleteMany({ where: { sessionId: sid } }),
      db.werewolfSession.delete({ where: { id: sid } }),
    ]);
  }

  // Create session + all players in one batch
  const newSession = await db.werewolfSession.create({
    data: {
      roomId: room.id,
      phase: "SETUP",
      selectedRoles: JSON.stringify(selectedRoles),
      decoyRoles: JSON.stringify(decoyRoles),
      playerCount: players.length,
      nightNumber: 0,
      dayNumber: 0,
      playerRoles: {
        createMany: {
          data: players.map((p, i) => ({
            userId: p.userId,
            role: shuffledRoles[i],
            team: getTeam(shuffledRoles[i]),
            status: "alive",
          })),
        },
      },
    },
  });

  const assignments = players.map((p, i) => ({
    userId: p.userId,
    seatName: p.seatName,
    seatOrder: p.seatOrder,
    name: p.user.nickname || p.user.firstName || `User ${p.userId}`,
    role: shuffledRoles[i],
    team: getTeam(shuffledRoles[i]),
  }));

  return NextResponse.json({ sessionId: newSession.id, assignments });
}
