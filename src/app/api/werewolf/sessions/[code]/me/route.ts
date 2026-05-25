import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { stepToRoles } from "@/lib/werewolf-roles";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);

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

  if (!room?.session) return NextResponse.json({ phase: "SETUP", role: null, isMyTurn: false });

  const s = room.session;
  const sp = s.playerRoles.find((p) => p.userId === userId) ?? null;

  let isMyTurn = false;
  if (s.phase === "PLAYING" && s.currentStep && sp && sp.status !== "dead") {
    for (const [stepKey, roles] of Object.entries(stepToRoles)) {
      if (s.currentStep.includes(stepKey) || roles.some((r) => s.currentStep!.includes(r.split(" (")[0]))) {
        if (roles.includes(sp.role)) { isMyTurn = true; break; }
      }
    }
  }

  let isWin: boolean | null = null;
  if (s.phase === "ENDED" && s.winTeam && sp) {
    isWin = sp.team === s.winTeam;
  }

  const hasActed = s.nightActions.some((a) => a.actorUserId === userId && a.night === s.nightNumber);
  const hasVoted = s.votes.some((v) => v.voterUserId === userId && v.day === s.dayNumber);
  const isVotingPhase = s.currentStep?.includes("🗳️") ?? false;
  const canAct = isMyTurn && !hasActed && sp?.status !== "dead";
  const canVote = isVotingPhase && !hasVoted && sp?.status !== "dead";

  const alivePlayers = s.playerRoles
    .filter((p) => p.status !== "dead")
    .map((p) => ({
      userId: p.userId,
      name: p.user.nickname || p.user.firstName || `User ${p.userId}`,
    }));

  return NextResponse.json({
    phase: s.phase,
    role: sp?.role ?? null,
    team: sp?.team ?? null,
    status: sp?.status ?? null,
    currentStep: s.currentStep ?? null,
    isMyTurn,
    canAct,
    canVote,
    hasActed,
    hasVoted,
    winTeam: s.winTeam ?? null,
    isWin,
    alivePlayers,
    nightNumber: s.nightNumber,
    dayNumber: s.dayNumber,
  });
}
