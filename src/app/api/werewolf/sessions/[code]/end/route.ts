import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { calcPoints } from "@/lib/werewolf-scoring";
import { patchWerewolfFb } from "@/lib/firebase-rtdb";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER" && session.user.role !== "CASHIER")) return null;
  return session;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const gmSession = await requireGM();
  if (!gmSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { winTeam } = await req.json();
  if (!winTeam) return NextResponse.json({ error: "ต้องระบุ winTeam" }, { status: 400 });

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: { session: { include: { playerRoles: true } } },
  });

  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });
  const s = room.session;

  // Guard against double-scoring: if this session was already ended/scored, do not award again.
  if (s.phase === "ENDED" || s.gameId) {
    return NextResponse.json({ error: "เกมนี้บันทึกคะแนนไปแล้ว", alreadyScored: true }, { status: 409 });
  }

  const playerCount = s.playerCount || s.playerRoles.length;
  const results = s.playerRoles.map((sp) => {
    const isWin = sp.team === winTeam;
    return { userId: sp.userId, team: sp.team, role: sp.role, isWin, pointsEarned: calcPoints({ isWin, team: sp.team, playerCount }) };
  });

  const game = await db.werewolfGame.create({
    data: {
      roomId: room.id,
      gmId: Number(gmSession.user.id),
      winTeam,
      results: {
        create: results.map((r) => ({ userId: r.userId, team: r.team, role: r.role, isWin: r.isWin, pointsEarned: r.pointsEarned })),
      },
    },
  });

  await db.werewolfSession.update({ where: { id: s.id }, data: { phase: "ENDED", winTeam, gameId: game.id } });

  await Promise.all(
    results.map((r) => db.user.update({ where: { id: r.userId }, data: { points: { increment: r.pointsEarned } } }))
  );

  // Push game over state to Firebase
  await patchWerewolfFb(code, { phase: "ENDED", winTeam });

  return NextResponse.json({ gameId: game.id, results });
}
