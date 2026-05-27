import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { patchWerewolfFb } from "@/lib/firebase-rtdb";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const gmSession = await requireGM();
  if (!gmSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: {
      players: {
        select: { userId: true, seatName: true, seatOrder: true },
        orderBy: [{ seatOrder: "asc" }, { joinedAt: "asc" }],
      },
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

  const seatMap = new Map(room.players.map((p) => [p.userId, { seatName: p.seatName, seatOrder: p.seatOrder }]));

  // Live progress for the current night/day so the GM panel reflects the real game state
  const nightActions = room.session.nightActions.filter((a) => a.night === room.session!.nightNumber);
  const dayVotes = room.session.votes.filter((v) => v.day === room.session!.dayNumber);
  const voteTally: Record<number, number> = {};
  for (const v of dayVotes) voteTally[v.targetUserId] = (voteTally[v.targetUserId] ?? 0) + 1;

  // Sort playerRoles by seatOrder so canvas places tokens in seat order
  const playerRoles = room.session.playerRoles
    .map((sp) => ({
      ...sp,
      seatName: seatMap.get(sp.userId)?.seatName ?? null,
      seatOrder: seatMap.get(sp.userId)?.seatOrder ?? 999,
      hasActed: nightActions.some((a) => a.actorUserId === sp.userId),
      hasVoted: dayVotes.some((v) => v.voterUserId === sp.userId),
      voteCount: voteTally[sp.userId] ?? 0,
    }))
    .sort((a, b) => a.seatOrder - b.seatOrder);

  const sessionData = { ...room.session, playerRoles };
  return NextResponse.json(sessionData);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const gmSession = await requireGM();
  if (!gmSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { currentStep, phase, timeOfDay, resetActions } = body;

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: { session: { include: resetActions ? { playerRoles: true } : undefined } },
  });
  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });

  const updated = await db.werewolfSession.update({
    where: { id: room.session.id },
    data: {
      ...(currentStep !== undefined ? { currentStep } : {}),
      ...(phase !== undefined ? { phase } : {}),
    },
  });

  // Push to Firebase
  const patch: Record<string, unknown> = {};
  if (currentStep !== undefined) patch.currentStep = currentStep;
  if (phase !== undefined) patch.phase = phase;
  // A new night begins: clear the previous announcement and let every living player act again.
  if (resetActions) {
    patch.announcement = null;
    const roles = (room.session as { playerRoles?: { userId: number }[] }).playerRoles ?? [];
    for (const sp of roles) {
      patch[`players/${sp.userId}/hasActed`] = false;
      patch[`players/${sp.userId}/hasVoted`] = false;
    }
  }
  // timeOfDay tells player phones whether to show day / night / intro / vote without
  // guessing from step text. Use the explicit value, else derive from currentStep.
  if (timeOfDay !== undefined) patch.timeOfDay = timeOfDay;
  else if (typeof currentStep === "string") {
    patch.timeOfDay = currentStep.startsWith("☀️") ? "day"
      : (currentStep.includes("🗳️") || currentStep.includes("❓")) ? "vote"
      : currentStep.includes("แนะนำตัว") ? "intro"
      : "night";
  }
  // Clear voteDecision when step changes away from vote-decision phase
  if (currentStep !== undefined && currentStep !== "❓ โหวตประหาร?") patch.voteDecision = null;
  if (Object.keys(patch).length) await patchWerewolfFb(code, patch as never);

  return NextResponse.json(updated);
}
