import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { patchWerewolfFb } from "@/lib/firebase-rtdb";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number(session.user.id);

  const { vote } = await req.json() as { vote: "yes" | "no" };
  if (vote !== "yes" && vote !== "no") return NextResponse.json({ error: "vote must be yes or no" }, { status: 400 });

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: { session: { include: { playerRoles: true } } },
  });
  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });

  const s = room.session;
  if (s.phase !== "PLAYING" || s.currentStep !== "❓ โหวตประหาร?") {
    return NextResponse.json({ error: "ไม่ใช่ช่วงโหวตประหาร" }, { status: 400 });
  }

  const sp = s.playerRoles.find((p) => p.userId === userId);
  if (!sp || sp.status === "dead") return NextResponse.json({ error: "ไม่มีสิทธิ์โหวต" }, { status: 403 });

  const alivePlayers = s.playerRoles.filter((p) => p.status !== "dead");
  const aliveCount = alivePlayers.length;

  // Update Firebase voteDecision atomically
  const updateFlat: Record<string, unknown> = {
    [`voteDecision/voters/${userId}`]: vote === "yes",
    _ts: Date.now(),
  };
  await patchWerewolfFb(code, updateFlat as never);

  // Read current voteDecision from DB (Firebase read is complex, so we just tally from what we know)
  // We'll rely on client-side to show counts; server just updates the voters map
  // But we need to check majority — fetch current from Firebase
  const fbRes = await fetch(
    `${process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL}/werewolf/sessions/${code}/voteDecision.json`
  );
  let voteDecision: { yes?: number; no?: number; voters?: Record<string, boolean> } = {};
  if (fbRes.ok) {
    const raw = await fbRes.json();
    if (raw) voteDecision = raw;
  }

  const voters = { ...(voteDecision.voters ?? {}), [String(userId)]: vote === "yes" };
  const yesCount = Object.values(voters).filter(Boolean).length;
  const noCount = Object.values(voters).filter((v) => !v).length;
  const majority = Math.floor(aliveCount / 2) + 1;

  // Update yes/no counts
  await patchWerewolfFb(code, {
    "voteDecision/yes": yesCount,
    "voteDecision/no": noCount,
  } as never);

  if (yesCount >= majority) {
    // Open actual vote
    const newDay = s.dayNumber + 1;
    await db.werewolfSession.update({
      where: { id: s.id },
      data: { currentStep: "🗳️ โหวต", dayNumber: newDay },
    });
    const fbPlayers: Record<string, { status: string; hasActed: boolean; hasVoted: boolean; voteCount: number }> = {};
    for (const p of s.playerRoles) {
      fbPlayers[String(p.userId)] = { status: p.status, hasActed: false, hasVoted: false, voteCount: 0 };
    }
    await patchWerewolfFb(code, {
      currentStep: "🗳️ โหวต",
      dayNumber: newDay,
      players: fbPlayers,
      voteDecision: null,
    });
    return NextResponse.json({ ok: true, result: "vote_opened" });
  }

  if (noCount >= majority) {
    // Skip vote → night
    await db.werewolfSession.update({ where: { id: s.id }, data: { currentStep: "🌙 กลางคืน" } });
    await patchWerewolfFb(code, { currentStep: "🌙 กลางคืน", voteDecision: null });
    return NextResponse.json({ ok: true, result: "vote_skipped" });
  }

  return NextResponse.json({ ok: true, result: "waiting", yesCount, noCount, aliveCount });
}
