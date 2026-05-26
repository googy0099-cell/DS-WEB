import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { stepToRoles } from "@/lib/werewolf-roles";
import { actionTypeForRole } from "@/lib/werewolf-scoring";
import { patchWerewolfPlayerFb } from "@/lib/firebase-rtdb";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number(session.user.id);

  const { targetUserId } = await req.json();

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: {
      session: { include: { playerRoles: true, nightActions: true } },
    },
  });

  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });
  const s = room.session;

  if (s.phase !== "PLAYING") return NextResponse.json({ error: "ไม่อยู่ในช่วงเกม" }, { status: 400 });

  const sp = s.playerRoles.find((p) => p.userId === userId);
  if (!sp) return NextResponse.json({ error: "ไม่ได้อยู่ใน session นี้" }, { status: 403 });
  if (sp.status === "dead") return NextResponse.json({ error: "คุณตายไปแล้ว" }, { status: 400 });

  let isMyTurn = false;
  if (s.currentStep) {
    for (const [, roles] of Object.entries(stepToRoles)) {
      if (roles.includes(sp.role)) {
        const keyMatch = Object.entries(stepToRoles).find(([, rs]) => rs.includes(sp.role));
        if (keyMatch && (s.currentStep.includes(keyMatch[0]) || roles.some((r) => s.currentStep!.includes(r.split(" (")[0])))) {
          isMyTurn = true;
          break;
        }
      }
    }
  }
  if (!isMyTurn) return NextResponse.json({ error: "ไม่ใช่คิวของคุณ" }, { status: 400 });

  const alreadyActed = s.nightActions.some((a) => a.actorUserId === userId && a.night === s.nightNumber);
  if (alreadyActed) return NextResponse.json({ error: "ส่งแล้วในคืนนี้" }, { status: 400 });

  if (targetUserId) {
    if (targetUserId > 0) {
      // Online player: validate against session
      const target = s.playerRoles.find((p) => p.userId === targetUserId);
      if (!target || target.status === "dead") return NextResponse.json({ error: "เป้าหมายไม่ถูกต้อง" }, { status: 400 });
    }
    // Negative = virtual offline player managed on GM canvas — skip DB validation
  }

  const actionType = actionTypeForRole(sp.role);

  await db.werewolfNightAction.create({
    data: { sessionId: s.id, night: s.nightNumber, actorUserId: userId, targetUserId: targetUserId ?? null, actionType },
  });

  // Push to Firebase immediately
  await patchWerewolfPlayerFb(code, userId, { hasActed: true });

  return NextResponse.json({ ok: true, actionType });
}
