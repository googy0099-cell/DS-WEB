import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { patchWerewolfFb, patchWerewolfPlayersFb } from "@/lib/firebase-rtdb";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const gmSession = await requireGM();
  if (!gmSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: { session: { include: { playerRoles: true } } },
  });

  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });
  const s = room.session;
  if (s.phase !== "PLAYING") return NextResponse.json({ error: "ไม่อยู่ในช่วงเกม" }, { status: 400 });

  const newDay = s.dayNumber + 1;
  await db.werewolfSession.update({
    where: { id: s.id },
    data: { currentStep: "🗳️ โหวต", dayNumber: newDay },
  });

  // Vampire (แวมไพร์): victims bitten last night die now that the vote opens.
  const vampVictims = s.playerRoles.filter((p) => p.status === "vamp_marked");
  if (vampVictims.length) {
    await db.werewolfSessionPlayer.updateMany({
      where: { sessionId: s.id, userId: { in: vampVictims.map((v) => v.userId) } },
      data: { status: "dead" },
    });
  }

  const freshPlayers = await db.werewolfSessionPlayer.findMany({ where: { sessionId: s.id } });
  // Reset hasVoted + voteCount for new round; use flat paths to preserve offline player entries
  const fbPlayers: Record<string, { status: string; hasActed: boolean; hasVoted: boolean; voteCount: number }> = {};
  for (const sp of freshPlayers) {
    fbPlayers[String(sp.userId)] = { status: sp.status, hasActed: false, hasVoted: false, voteCount: 0 };
  }
  await patchWerewolfFb(code, { currentStep: "🗳️ โหวต", timeOfDay: "vote", dayNumber: newDay } as never);
  await patchWerewolfPlayersFb(code, fbPlayers);

  return NextResponse.json({ ok: true, dayNumber: newDay });
}
