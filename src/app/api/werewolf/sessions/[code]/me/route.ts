import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { stepToRoles } from "@/lib/werewolf-roles";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: {
      session: {
        include: { playerRoles: { where: { userId } } },
      },
    },
  });

  if (!room?.session) return NextResponse.json({ phase: "SETUP", role: null, isMyTurn: false });

  const s = room.session;
  const sp = s.playerRoles[0] ?? null;

  let isMyTurn = false;
  if (s.phase === "PLAYING" && s.currentStep && sp) {
    for (const [stepKey, roles] of Object.entries(stepToRoles)) {
      if (s.currentStep.includes(stepKey) || roles.some((r) => s.currentStep!.includes(r.split(' (')[0]))) {
        if (roles.includes(sp.role)) { isMyTurn = true; break; }
      }
    }
  }

  let isWin: boolean | null = null;
  if (s.phase === "ENDED" && s.winTeam && sp) {
    isWin = sp.team === s.winTeam;
  }

  return NextResponse.json({
    phase: s.phase,
    role: sp?.role ?? null,
    team: sp?.team ?? null,
    currentStep: s.currentStep ?? null,
    isMyTurn,
    winTeam: s.winTeam ?? null,
    isWin,
  });
}
