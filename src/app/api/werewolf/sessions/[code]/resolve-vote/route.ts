import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { patchWerewolfFb, patchWerewolfPlayersFb } from "@/lib/firebase-rtdb";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER" && session.user.role !== "CASHIER")) return null;
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
    await patchWerewolfFb(code, { currentStep: "🌙 กลางคืน", timeOfDay: "night" } as never);
    return NextResponse.json({ ok: true, eliminated: null, tie: false, reason: "no_votes" });
  }

  // Mayor (นายกเทศมนตรี): his vote always counts as 2.
  const tally: Record<number, number> = {};
  for (const vote of dayVotes) {
    const voter = s.playerRoles.find((p) => p.userId === vote.voterUserId);
    const weight = voter && voter.role.includes("นายกเทศมนตรี") ? 2 : 1;
    tally[vote.targetUserId] = (tally[vote.targetUserId] ?? 0) + weight;
  }

  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const topCount = sorted[0][1];
  const topCandidates = sorted.filter(([, c]) => c === topCount);
  const tie = topCandidates.length > 1;
  let eliminatedUserId: number | null = null;

  let princeSaved = false;
  if (!tie) {
    eliminatedUserId = Number(topCandidates[0][0]);
    const elimRole = s.playerRoles.find((p) => p.userId === eliminatedUserId);
    // Prince (เจ้าชาย): reveals his role and is NOT executed by the village vote.
    if (elimRole && elimRole.role.includes("เจ้าชาย")) {
      princeSaved = true;
      eliminatedUserId = null;
    } else {
      await db.werewolfSessionPlayer.updateMany({
        where: { sessionId: s.id, userId: eliminatedUserId },
        data: { status: "dead" },
      });
    }
  }

  await db.werewolfSession.update({ where: { id: s.id }, data: { currentStep: "🌙 กลางคืน" } });

  // Cupid (กามเทพ): an executed lover drags their partner to the grave.
  let loverDiedUserId: number | null = null;
  if (eliminatedUserId !== null) {
    try {
      const lr = await fetch(`${process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL}/werewolf/sessions/${code}/lovers.json`);
      if (lr.ok) {
        const lovers = await lr.json();
        if (Array.isArray(lovers) && lovers.length === 2 && lovers.includes(eliminatedUserId)) {
          const partner = lovers[0] === eliminatedUserId ? lovers[1] : lovers[0];
          const partnerRow = s.playerRoles.find((p) => p.userId === partner);
          if (partnerRow && partnerRow.status !== "dead") {
            loverDiedUserId = partner;
            await db.werewolfSessionPlayer.updateMany({ where: { sessionId: s.id, userId: partner }, data: { status: "dead" } });
          }
        }
      }
    } catch {}
  }

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
  else if (princeSaved) announcement = "👑 เจ้าชายเผยตัว! รอดจากการประหาร — ไม่มีใครถูกกำจัด";
  else if (eliminatedUserId) {
    announcement = `☀️ ผลโหวต: ${getPlayerName(eliminatedUserId)} ถูกประหาร`;
    if (loverDiedUserId !== null) announcement += ` · 💔 ${getPlayerName(loverDiedUserId)} ตรอมใจตายตาม`;
  } else announcement = "☀️ ผลโหวต: ไม่มีการประหาร";

  // Push to Firebase — reset hasActed for the new night; use flat paths to preserve offline player entries
  const fbPlayers: Record<string, { status: string; hasActed: boolean; hasVoted: boolean; voteCount: number }> = {};
  for (const sp of updatedPlayers) {
    fbPlayers[String(sp.userId)] = { status: sp.status, hasActed: false, hasVoted: false, voteCount: 0 };
  }
  await patchWerewolfFb(code, {
    currentStep: "🌙 กลางคืน",
    timeOfDay: "night",
    announcement,
    ...(winTeam ? { winTeam } : {}),
  } as never);
  await patchWerewolfPlayersFb(code, fbPlayers);

  const eliminatedName = eliminatedUserId ? getPlayerName(eliminatedUserId) : null;
  // Hunter (นายพราน) executed by vote → GM fires its last shot.
  const elimRole2 = eliminatedUserId ? s.playerRoles.find((p) => p.userId === eliminatedUserId) : null;
  const hunters = elimRole2 && elimRole2.role.includes("นายพราน")
    ? [{ userId: eliminatedUserId as number, name: eliminatedName as string }]
    : [];
  return NextResponse.json({ ok: true, eliminated: eliminatedUserId, eliminatedName, tie, tally, hunters, winTeam: winTeam ?? null });
}
