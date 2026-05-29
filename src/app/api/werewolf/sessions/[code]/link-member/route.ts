import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { getTeam } from "@/lib/werewolf-roles";
import { patchWerewolfFb } from "@/lib/firebase-rtdb";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER" && session.user.role !== "CASHIER")) return null;
  return session;
}

// Links an offline canvas player to a real member (by memberCode) so they earn points
// at end-game. Creates/updates a WerewolfSessionPlayer row keyed by the real userId.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!(await requireGM())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberCode, role, status } = await req.json();
  if (!memberCode || typeof memberCode !== "string")
    return NextResponse.json({ error: "ต้องระบุรหัสลูกค้า" }, { status: 400 });

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: { session: { select: { id: true } } },
  });
  if (!room?.session) return NextResponse.json({ error: "ยังไม่ได้แจกไพ่/เริ่มเกม" }, { status: 404 });

  const user = await db.user.findUnique({
    where: { memberCode: memberCode.trim() },
    select: { id: true, firstName: true, nickname: true },
  });
  if (!user) return NextResponse.json({ error: "ไม่พบรหัสลูกค้านี้ (ต้องเป็นสมาชิกที่สมัครแล้ว)" }, { status: 404 });

  const finalRole = role && role !== "ไม่ระบุ" ? role : "ชาวบ้าน (Villager)";
  const team = getTeam(finalRole);
  const finalStatus = status || "alive";

  const existing = await db.werewolfSessionPlayer.findUnique({
    where: { sessionId_userId: { sessionId: room.session.id, userId: user.id } },
  });
  if (existing) {
    await db.werewolfSessionPlayer.update({
      where: { id: existing.id },
      data: { role: finalRole, team, status: finalStatus },
    });
  } else {
    await db.werewolfSessionPlayer.create({
      data: { sessionId: room.session.id, userId: user.id, role: finalRole, team, status: finalStatus },
    });
  }

  const name = user.nickname || user.firstName || `User ${user.id}`;
  await patchWerewolfFb(code, {
    [`playerNames/${user.id}`]: name,
    [`players/${user.id}`]: { status: finalStatus, hasActed: false, hasVoted: false, voteCount: 0 },
  } as never);

  return NextResponse.json({ ok: true, userId: user.id, name, memberCode: memberCode.trim() });
}
