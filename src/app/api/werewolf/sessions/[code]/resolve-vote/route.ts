import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { patchWerewolfFb } from "@/lib/firebase-rtdb";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

function checkWinCondition(players: { team: string; status: string }[]): string | null {
  const alive = players.filter((p) => p.status !== "dead");
  const wolfAlive = alive.filter((p) => p.team === "wolf").length;
  const vampireAlive = alive.filter((p) => p.team === "vampire").length;
  const villageAlive = alive.filter((p) => p.team === "village").length;
  const indyAlive = alive.filter((p) => p.team === "indy").length;

  if (wolfAlive === 0 && vampireAlive === 0) return "village";
  if (wolfAlive > 0 && wolfAlive >= villageAlive + indyAlive) return "wolf";
  if (vampireAlive > 0 && wolfAlive === 0 && villageAlive === 0) return "vampire";
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const gmSession = await requireGM();
  if (!gmSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: {
      players: { select: { userId: true, seatName: true } },
      session: {
        include: {
          playerRoles: { include: { user: { select: { id: true, firstName: true, nickname: true } } } },
          votes: true,
        },
      },
    },
  });

  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });
  const s = room.session;
  if (s.phase !== "PLAYING") return NextResponse.json({ error: "ไม่อยู่ในช่วงเกม" }, { status: 400 });

  const dayVotes = s.votes.filter((v) => v.day === s.dayNumber);

  if (dayVotes.length === 0) {
    await db.werewolfSession.update({ where: { id: s.id }, data: { currentStep: "🌙 กลางคืน" } });
    await patchWerewolfFb(code, { currentStep: "🌙 กลางคืน" });
    return NextResponse.json({ ok: true, eliminated: null, tie: false, reason: "no_votes" });
  }

  const tally: Record<number, number> = {};
  for (const vote of dayVotes) tally[vote.targetUserId] = (tally[vote.targetUserId] ?? 0) + 1;

  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const topCount = sorted[0][1];
  const topCandidates = sorted.filter(([, c]) => c === topCount);
  const tie = topCandidates.length > 1;
  let eliminatedUserId: number | null = null;

  if (!tie) {
    eliminatedUserId = Number(topCandidates[0][0]);
    await db.werewolfSessionPlayer.updateMany({
      where: { sessionId: s.id, userId: eliminatedUserId },
      data: { status: "dead" },
    });
  }

  await db.werewolfSession.update({ where: { id: s.id }, data: { currentStep: "🌙 กลางคืน" } });

  const updatedPlayers = await db.werewolfSessionPlayer.findMany({ where: { sessionId: s.id } });
  const winTeam = checkWinCondition(updatedPlayers);
  if (winTeam) await db.werewolfSession.update({ where: { id: s.id }, data: { winTeam } });

  // Build announcement
  const seatMap = new Map((room.players ?? []).map((p) => [p.userId, p.seatName]));
  const getPlayerName = (id: number) => {
    const sp = s.playerRoles.find((p) => p.userId === id);
    return seatMap.get(id) ?? sp?.user?.nickname ?? sp?.user?.firstName ?? `Player ${id}`;
  };
  let announcement: string;
  if (tie) announcement = "☀️ ผลโหวต: คะแนนเท่ากัน — ไม่มีการประหาร";
  else if (eliminatedUserId) announcement = `☀️ ผลโหวต: ${getPlayerName(eliminatedUserId)} ถูกประหาร`;
  else announcement = "☀️ ผลโหวต: ไม่มีการประหาร";

  // Push to Firebase — reset hasActed for the new night
  const fbPlayers: Record<string, { status: string; hasActed: boolean; hasVoted: boolean; voteCount: number }> = {};
  for (const sp of updatedPlayers) {
    fbPlayers[String(sp.userId)] = { status: sp.status, hasActed: false, hasVoted: false, voteCount: 0 };
  }
  await patchWerewolfFb(code, {
    currentStep: "🌙 กลางคืน",
    players: fbPlayers,
    announcement,
    ...(winTeam ? { winTeam } : {}),
  });

  const eliminatedName = eliminatedUserId ? getPlayerName(eliminatedUserId) : null;
  return NextResponse.json({ ok: true, eliminated: eliminatedUserId, eliminatedName, tie, tally, winTeam: winTeam ?? null });
}
