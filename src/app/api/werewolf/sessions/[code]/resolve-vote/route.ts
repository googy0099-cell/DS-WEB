import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

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
      session: {
        include: {
          playerRoles: true,
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
    // No votes cast — skip elimination
    await db.werewolfSession.update({
      where: { id: s.id },
      data: { currentStep: "🌙 กลางคืน" },
    });
    return NextResponse.json({ ok: true, eliminated: null, tie: false, reason: "no_votes" });
  }

  // Tally votes
  const tally: Record<number, number> = {};
  for (const vote of dayVotes) {
    tally[vote.targetUserId] = (tally[vote.targetUserId] ?? 0) + 1;
  }

  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const topCount = sorted[0][1];
  const topCandidates = sorted.filter(([, c]) => c === topCount);

  let eliminatedUserId: number | null = null;
  const tie = topCandidates.length > 1;

  if (!tie) {
    eliminatedUserId = Number(topCandidates[0][0]);
  }

  if (eliminatedUserId) {
    await db.werewolfSessionPlayer.updateMany({
      where: { sessionId: s.id, userId: eliminatedUserId },
      data: { status: "dead" },
    });
  }

  // Move to night phase
  await db.werewolfSession.update({
    where: { id: s.id },
    data: { currentStep: "🌙 กลางคืน" },
  });

  // Check win condition
  const updatedPlayers = await db.werewolfSessionPlayer.findMany({ where: { sessionId: s.id } });
  const winTeam = checkWinCondition(updatedPlayers);
  if (winTeam) {
    await db.werewolfSession.update({ where: { id: s.id }, data: { winTeam } });
  }

  return NextResponse.json({
    ok: true,
    eliminated: eliminatedUserId,
    tie,
    tally,
    winTeam: winTeam ?? null,
  });
}
