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
      players: { select: { userId: true, seatName: true, seatOrder: true } },
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

  const killTargetIds = new Set<number>();
  const protectedIds = new Set<number>();

  // actionType is derived from the actor's role at record time (online phone or GM-recorded
  // offline pointing), so trust it directly — offline actors have no playerRoles row.
  for (const action of nightActions) {
    if (!action.targetUserId) continue;
    if (action.actionType === "kill") killTargetIds.add(action.targetUserId);
    if (action.actionType === "protect") protectedIds.add(action.targetUserId);
  }

  // Wolf pack consensus — take majority kill target. Online wolves have a playerRoles row;
  // offline (negative actorUserId) kill actions can't be team-verified, so include them too.
  const wolfActions = nightActions.filter((a) => {
    if (a.actionType !== "kill" || !a.targetUserId) return false;
    const actor = s.playerRoles.find((sp) => sp.userId === a.actorUserId);
    if (actor) return actor.team === "wolf";
    return a.actorUserId < 0; // offline canvas token
  });
  let wolfKillTarget: number | null = null;
  if (wolfActions.length > 0) {
    const tally: Record<number, number> = {};
    wolfActions.forEach((a) => { tally[a.targetUserId!] = (tally[a.targetUserId!] ?? 0) + 1; });
    wolfKillTarget = Number(Object.entries(tally).sort((x, y) => y[1] - x[1])[0][0]);
    wolfActions.forEach((a) => killTargetIds.delete(a.targetUserId!));
    killTargetIds.add(wolfKillTarget);
  }

  // Diseased (ผู้ป่วยติดเชื้อ): if a Diseased was eaten last night, the wolves are sick and cannot
  // kill this night. The flag is stored in Firebase between nights.
  let wolvesBlocked = false;
  let lovers: number[] = [];
  try {
    const fr = await fetch(`${process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL}/werewolf/sessions/${code}/flags/wolvesBlocked.json`);
    if (fr.ok) wolvesBlocked = (await fr.json()) === true;
    const lr = await fetch(`${process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL}/werewolf/sessions/${code}/lovers.json`);
    if (lr.ok) { const v = await lr.json(); if (Array.isArray(v)) lovers = v; }
  } catch {}
  if (wolvesBlocked && wolfKillTarget !== null) {
    killTargetIds.delete(wolfKillTarget);
    wolfKillTarget = null;
  }

  // Cursed (ผู้ต้องคำสาป): if the WOLVES' kill target is Cursed and not protected, they do not
  // die — they convert to a Werewolf. Other killers (serial killer, vampire) still kill them.
  const cursedConversions: number[] = [];
  if (wolfKillTarget !== null && !protectedIds.has(wolfKillTarget)) {
    const target = s.playerRoles.find((sp) => sp.userId === wolfKillTarget);
    if (target && target.role.includes("ผู้ต้องคำสาป") && target.status !== "dead") {
      cursedConversions.push(wolfKillTarget);
      killTargetIds.delete(wolfKillTarget);
    }
  }

  // Tough Guy (จอมอึด): a wolf bite doesn't kill immediately — they're "wounded" and die the
  // following night. Stored via the free-text status field (no schema change).
  const toughGuyWounds: number[] = [];
  if (wolfKillTarget !== null && !protectedIds.has(wolfKillTarget) && !cursedConversions.includes(wolfKillTarget)) {
    const t = s.playerRoles.find((sp) => sp.userId === wolfKillTarget);
    if (t && t.role.includes("จอมอึด") && t.status === "alive") {
      toughGuyWounds.push(wolfKillTarget);
      killTargetIds.delete(wolfKillTarget);
    }
  }

  // Delayed deaths: anyone wounded on a previous night now succumbs (Tough Guy's second night).
  const delayedDeaths = s.playerRoles.filter((sp) => sp.status === "wounded").map((sp) => sp.userId);

  // Vampire (แวมไพร์): the bite does not kill at night — the victim dies when the next vote opens.
  // Pull vampire targets out of tonight's kills and mark them instead.
  const vampActions = nightActions.filter((a) => {
    if (a.actionType !== "kill" || !a.targetUserId) return false;
    return s.playerRoles.find((sp) => sp.userId === a.actorUserId)?.team === "vampire";
  });
  const vampTargets = new Set(vampActions.map((a) => a.targetUserId!));
  vampTargets.forEach((id) => killTargetIds.delete(id));

  const directKills = [...killTargetIds].filter((id) => !protectedIds.has(id));
  let finalKills = [...new Set([...directKills, ...delayedDeaths])];

  // Mark vampire victims who aren't already dying — they perish at the next vote opening.
  const vampMarks = [...vampTargets].filter(
    (id) => !finalKills.includes(id) && !protectedIds.has(id) && s.playerRoles.find((p) => p.userId === id)?.status === "alive"
  );

  // Bomber (มือระเบิดพลีชีพ): when killed, the players seated on both sides also die in the blast.
  // Uses the real seat order; only online (seated) players are chained.
  const seatList = [...(room.players ?? [])].sort((a, b) => a.seatOrder - b.seatOrder);
  const bomberExtra: number[] = [];
  for (const uid of finalKills) {
    const r = s.playerRoles.find((p) => p.userId === uid);
    if (r && r.role.includes("มือระเบิดพลีชีพ") && seatList.length > 1) {
      const idx = seatList.findIndex((p) => p.userId === uid);
      if (idx >= 0) {
        const left = seatList[(idx - 1 + seatList.length) % seatList.length];
        const right = seatList[(idx + 1) % seatList.length];
        for (const n of [left, right]) if (n && n.userId !== uid) bomberExtra.push(n.userId);
      }
    }
  }
  finalKills = [...new Set([...finalKills, ...bomberExtra])];

  // Cupid (กามเทพ): if one lover dies, the other dies of heartbreak.
  if (lovers.length === 2) {
    const alreadyDead = new Set(s.playerRoles.filter((p) => p.status === "dead").map((p) => p.userId));
    const deadAfter = new Set([...alreadyDead, ...finalKills]);
    const [a, b] = lovers;
    if (deadAfter.has(a) && !deadAfter.has(b)) finalKills.push(b);
    else if (deadAfter.has(b) && !deadAfter.has(a)) finalKills.push(a);
    finalKills = [...new Set(finalKills)];
  }

  await Promise.all([
    ...finalKills.map((userId) =>
      db.werewolfSessionPlayer.updateMany({ where: { sessionId: s.id, userId }, data: { status: "dead" } })
    ),
    ...toughGuyWounds.map((userId) =>
      db.werewolfSessionPlayer.updateMany({ where: { sessionId: s.id, userId }, data: { status: "wounded" } })
    ),
    ...vampMarks.map((userId) =>
      db.werewolfSessionPlayer.updateMany({ where: { sessionId: s.id, userId }, data: { status: "vamp_marked" } })
    ),
    ...cursedConversions.map((userId) =>
      db.werewolfSessionPlayer.updateMany({
        where: { sessionId: s.id, userId },
        data: { team: "wolf", role: "หมาป่า (Werewolf)" },
      })
    ),
  ]);

  const newNight = s.nightNumber + 1;
  await db.werewolfSession.update({
    where: { id: s.id },
    data: { nightNumber: newNight, currentStep: "☀️ กลางวัน" },
  });

  const updatedPlayers = await db.werewolfSessionPlayer.findMany({ where: { sessionId: s.id } });
  const winTeam = checkWinCondition(updatedPlayers);
  if (winTeam) await db.werewolfSession.update({ where: { id: s.id }, data: { winTeam } });

  // Push to Firebase — use flat paths so virtual offline player entries are not overwritten
  const fbPlayerUpdates: Record<string, { status: string; hasActed: boolean; hasVoted: boolean; voteCount: number }> = {};
  for (const sp of updatedPlayers) {
    fbPlayerUpdates[String(sp.userId)] = { status: sp.status, hasActed: false, hasVoted: false, voteCount: 0 };
  }

  const seatMap = new Map((room.players ?? []).map((p) => [p.userId, p.seatName]));
  const getPlayerName = (id: number) => {
    const sp = s.playerRoles.find((p) => p.userId === id);
    return seatMap.get(id) ?? sp?.user?.nickname ?? sp?.user?.firstName ?? `Player ${id}`;
  };

  const killedNames = finalKills.map(getPlayerName).join(", ");
  const cursedNames = cursedConversions.map(getPlayerName).join(", ");
  // Hunter (นายพราน): if one died tonight, the GM is prompted to fire its last shot.
  const hunters = finalKills
    .filter((id) => s.playerRoles.find((p) => p.userId === id)?.role.includes("นายพราน"))
    .map((id) => ({ userId: id, name: getPlayerName(id) }));
  // Public announcement never reveals the Cursed conversion (it would expose them as a wolf).
  const announcement = finalKills.length
    ? `🌙 คืนที่ ${s.nightNumber}: ${killedNames} ถูกกำจัด`
    : `🌙 คืนที่ ${s.nightNumber}: ไม่มีผู้เสียชีวิต`;

  // Set the Diseased flag for next night if the wolves' victim this night was Diseased.
  const diseasedKilledByWolf =
    wolfKillTarget !== null &&
    finalKills.includes(wolfKillTarget) &&
    !!s.playerRoles.find((p) => p.userId === wolfKillTarget)?.role.includes("ผู้ป่วยติดเชื้อ");

  await patchWerewolfFb(code, {
    currentStep: "☀️ กลางวัน",
    timeOfDay: "day",
    nightNumber: newNight,
    announcement,
    "flags/wolvesBlocked": diseasedKilledByWolf,
    ...(winTeam ? { winTeam } : {}),
  } as never);
  await patchWerewolfPlayersFb(code, fbPlayerUpdates);

  return NextResponse.json({
    ok: true,
    killed: finalKills,
    protected: [...protectedIds],
    killedNames,
    cursed: cursedConversions,
    cursedNames, // GM-only: Cursed players who turned into wolves this night
    hunters, // dead Hunters → GM fires their last shot
    winTeam: winTeam ?? null,
  });
}
