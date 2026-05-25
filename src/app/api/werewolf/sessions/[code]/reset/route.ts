import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { patchWerewolfFb } from "@/lib/firebase-rtdb";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!(await requireGM())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await db.werewolfRoom.findUnique({ where: { code }, include: { session: { include: { playerRoles: true } } } });
  if (!room?.session) return NextResponse.json({ ok: true });

  const s = room.session;

  // Clear roles + statuses back to standby
  await db.werewolfSessionPlayer.updateMany({
    where: { sessionId: s.id },
    data: { role: "", team: "", status: "alive" },
  });
  await db.werewolfSession.update({
    where: { id: s.id },
    data: { phase: "SETUP", currentStep: null, nightNumber: 0, dayNumber: 0, winTeam: null },
  });

  // Push standby state to Firebase
  const fbPlayers: Record<string, { status: string; hasActed: boolean; hasVoted: boolean; voteCount: number }> = {};
  for (const sp of s.playerRoles) {
    fbPlayers[String(sp.userId)] = { status: "alive", hasActed: false, hasVoted: false, voteCount: 0 };
  }
  await patchWerewolfFb(code, {
    phase: "SETUP",
    currentStep: null,
    winTeam: null,
    players: fbPlayers,
    announcement: null,
    voteDecision: null,
  });

  return NextResponse.json({ ok: true });
}
