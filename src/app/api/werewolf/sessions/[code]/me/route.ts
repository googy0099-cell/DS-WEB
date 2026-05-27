import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

// Returns only the player's secret role/team/status. Everything else (phase,
// currentStep, hasActed, hasVoted, alive players, etc.) is delivered in real time
// via Firebase, so this endpoint is called only at join and on deal (phase=SETUP).
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    select: {
      session: {
        select: {
          playerRoles: {
            where: { userId },
            select: { role: true, team: true, status: true },
          },
        },
      },
    },
  });

  const sp = room?.session?.playerRoles[0] ?? null;

  return NextResponse.json({
    role: sp?.role || null,
    team: sp?.team || null,
    status: sp?.status ?? null,
  });
}
