import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER" && session.user.role !== "CASHIER")) return null;
  return session;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const gmSession = await requireGM();
  if (!gmSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: {
      session: {
        include: {
          playerRoles: {
            include: { user: { select: { id: true, firstName: true, nickname: true } } },
          },
          nightActions: true,
          votes: true,
        },
      },
    },
  });

  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });
  const s = room.session;

  const nightActions = s.nightActions.filter((a) => a.night === s.nightNumber);
  const dayVotes = s.votes.filter((v) => v.day === s.dayNumber);

  // Build vote tally for current day
  const voteTally: Record<number, number> = {};
  for (const vote of dayVotes) {
    voteTally[vote.targetUserId] = (voteTally[vote.targetUserId] ?? 0) + 1;
  }

  const players = s.playerRoles.map((sp) => ({
    userId: sp.userId,
    name: sp.user.nickname || sp.user.firstName || `User ${sp.userId}`,
    role: sp.role,
    team: sp.team,
    status: sp.status,
    hasActed: nightActions.some((a) => a.actorUserId === sp.userId),
    hasVoted: dayVotes.some((v) => v.voterUserId === sp.userId),
    voteCount: voteTally[sp.userId] ?? 0,
  }));

  return NextResponse.json({
    phase: s.phase,
    nightNumber: s.nightNumber,
    dayNumber: s.dayNumber,
    currentStep: s.currentStep,
    winTeam: s.winTeam,
    players,
    nightActionCount: nightActions.length,
    voteCount: dayVotes.length,
    totalAlive: s.playerRoles.filter((sp) => sp.status !== "dead").length,
  });
}
