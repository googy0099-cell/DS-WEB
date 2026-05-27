import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { patchWerewolfFb, patchWerewolfPlayersFb } from "@/lib/firebase-rtdb";

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

// Hunter (นายพราน): when the Hunter dies (by wolves or by vote), the GM uses this to fire the
// Hunter's last shot — the chosen target is killed too.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!(await requireGM())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetUserId } = await req.json();
  if (typeof targetUserId !== "number") return NextResponse.json({ error: "ต้องระบุเป้าหมาย" }, { status: 400 });

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: {
      players: { select: { userId: true, seatName: true } },
      session: { include: { playerRoles: { include: { user: { select: { firstName: true, nickname: true } } } } } },
    },
  });
  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });
  const s = room.session;

  await db.werewolfSessionPlayer.updateMany({
    where: { sessionId: s.id, userId: targetUserId },
    data: { status: "dead" },
  });

  const updatedPlayers = await db.werewolfSessionPlayer.findMany({ where: { sessionId: s.id } });
  const winTeam = checkWinCondition(updatedPlayers);
  if (winTeam) await db.werewolfSession.update({ where: { id: s.id }, data: { winTeam } });

  const fbPlayerUpdates: Record<string, { status: string }> = {};
  for (const sp of updatedPlayers) fbPlayerUpdates[String(sp.userId)] = { status: sp.status };

  const seatMap = new Map((room.players ?? []).map((p) => [p.userId, p.seatName]));
  const sp = s.playerRoles.find((p) => p.userId === targetUserId);
  const targetName = seatMap.get(targetUserId) ?? sp?.user?.nickname ?? sp?.user?.firstName ?? `Player ${targetUserId}`;

  await patchWerewolfFb(code, {
    announcement: `🔫 นายพรานลั่นไก! ${targetName} ถูกลากไปด้วย`,
    ...(winTeam ? { winTeam } : {}),
  } as never);
  await patchWerewolfPlayersFb(code, fbPlayerUpdates as never);

  return NextResponse.json({ ok: true, targetUserId, targetName, winTeam: winTeam ?? null });
}
