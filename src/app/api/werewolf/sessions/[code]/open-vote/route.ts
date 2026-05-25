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

  // Reset hasVoted + voteCount for new round, push to Firebase
  const fbPlayers: Record<string, { status: string; hasActed: boolean; hasVoted: boolean; voteCount: number }> = {};
  for (const sp of s.playerRoles) {
    fbPlayers[String(sp.userId)] = { status: sp.status, hasActed: false, hasVoted: false, voteCount: 0 };
  }
  await patchWerewolfFb(code, { currentStep: "🗳️ โหวต", dayNumber: newDay, players: fbPlayers });

  return NextResponse.json({ ok: true, dayNumber: newDay });
}
