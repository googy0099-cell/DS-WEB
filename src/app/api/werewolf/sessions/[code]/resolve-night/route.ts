import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { wolfRoles, vampireRoles } from "@/lib/werewolf-roles";
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
          playerRoles: {
            include: { user: { select: { id: true, firstName: true, nickname: true } } },
          },
          nightActions: true,
        },
      },
    },
  });

  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });
  const s = room.session;
  if (s.phase !== "PLAYING") return NextResponse.json({ error: "ไม่อยู่ในช่วงเกม" }, { status: 400 });

  const nightActions = s.nightActions.filter((a) => a.night === s.nightNumber);

  const killActorIds = new Set(
    s.playerRoles
      .filter((sp) => sp.team === "wolf" || wolfRoles.includes(sp.role) || vampireRoles.includes(sp.role) || sp.team === "indy")
      .map((sp) => sp.userId)
  );

  const killTargetIds = new Set<number>();
  const protectedIds = new Set<number>();

  for (const action of nightActions) {
    if (!action.targetUserId) continue;
    if (action.actionType === "kill" && killActorIds.has(action.actorUserId)) killTargetIds.add(action.targetUserId);
    if (action.actionType === "protect") protectedIds.add(action.targetUserId);
  }

  // Wolf pack consensus — take majority kill target
  const wolfActions = nightActions.filter((a) => {
    const actor = s.playerRoles.find((sp) => sp.userId === a.actorUserId);
    return actor?.team === "wolf" && a.actionType === "kill" && a.targetUserId;
  });
  if (wolfActions.length > 0) {
    const tally: Record<number, number> = {};
    wolfActions.forEach((a) => { tally[a.targetUserId!] = (tally[a.targetUserId!] ?? 0) + 1; });
    const wolfKillTarget = Number(Object.entries(tally).sort((x, y) => y[1] - x[1])[0][0]);
    wolfActions.forEach((a) => killTargetIds.delete(a.targetUserId!));
    killTargetIds.add(wolfKillTarget);
  }

  const finalKills = [...killTargetIds].filter((id) => !protectedIds.has(id));

  await Promise.all(
    finalKills.map((userId) =>
      db.werewolfSessionPlayer.updateMany({ where: { sessionId: s.id, userId }, data: { status: "dead" } })
    )
  );

  const newNight = s.nightNumber + 1;
  await db.werewolfSession.update({
    where: { id: s.id },
    data: { nightNumber: newNight, currentStep: "☀️ กลางวัน" },
  });

  const updatedPlayers = await db.werewolfSessionPlayer.findMany({ where: { sessionId: s.id } });
  const winTeam = checkWinCondition(updatedPlayers);
  if (winTeam) await db.werewolfSession.update({ where: { id: s.id }, data: { winTeam } });

  // Push to Firebase
  const fbPlayers: Record<string, { status: string; hasActed: boolean; hasVoted: boolean; voteCount: number }> = {};
  for (const sp of updatedPlayers) {
    fbPlayers[String(sp.userId)] = { status: sp.status, hasActed: false, hasVoted: false, voteCount: 0 };
  }

  const seatMap = new Map((room.players ?? []).map((p) => [p.userId, p.seatName]));
  const getPlayerName = (id: number) => {
    const sp = s.playerRoles.find((p) => p.userId === id);
    return seatMap.get(id) ?? sp?.user?.nickname ?? sp?.user?.firstName ?? `Player ${id}`;
  };

  const killedNames = finalKills.map(getPlayerName).join(", ");
  const announcement = finalKills.length
    ? `🌙 คืนที่ ${s.nightNumber}: ${killedNames} ถูกกำจัด`
    : `🌙 คืนที่ ${s.nightNumber}: ไม่มีผู้เสียชีวิต`;

  await patchWerewolfFb(code, {
    currentStep: "☀️ กลางวัน",
    nightNumber: newNight,
    players: fbPlayers,
    announcement,
    ...(winTeam ? { winTeam } : {}),
  });

  return NextResponse.json({ ok: true, killed: finalKills, protected: [...protectedIds], killedNames, winTeam: winTeam ?? null });
}
