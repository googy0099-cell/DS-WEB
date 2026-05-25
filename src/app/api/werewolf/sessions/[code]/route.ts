import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { patchWerewolfFb } from "@/lib/firebase-rtdb";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const gmSession = await requireGM();
  if (!gmSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: {
      players: {
        select: { userId: true, seatName: true, seatOrder: true },
        orderBy: [{ seatOrder: "asc" }, { joinedAt: "asc" }],
      },
      session: {
        include: {
          playerRoles: {
            include: { user: { select: { id: true, firstName: true, nickname: true } } },
          },
        },
      },
    },
  });

  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });

  const seatMap = new Map(room.players.map((p) => [p.userId, { seatName: p.seatName, seatOrder: p.seatOrder }]));

  // Sort playerRoles by seatOrder so canvas places tokens in seat order
  const playerRoles = room.session.playerRoles
    .map((sp) => ({
      ...sp,
      seatName: seatMap.get(sp.userId)?.seatName ?? null,
      seatOrder: seatMap.get(sp.userId)?.seatOrder ?? 999,
    }))
    .sort((a, b) => a.seatOrder - b.seatOrder);

  const sessionData = { ...room.session, playerRoles };
  return NextResponse.json(sessionData);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const gmSession = await requireGM();
  if (!gmSession) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { currentStep, phase } = body;

  const room = await db.werewolfRoom.findUnique({ where: { code }, include: { session: true } });
  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });

  const updated = await db.werewolfSession.update({
    where: { id: room.session.id },
    data: {
      ...(currentStep !== undefined ? { currentStep } : {}),
      ...(phase !== undefined ? { phase } : {}),
    },
  });

  // Push to Firebase
  const patch: Record<string, unknown> = {};
  if (currentStep !== undefined) patch.currentStep = currentStep;
  if (phase !== undefined) patch.phase = phase;
  // Clear voteDecision when step changes away from vote-decision phase
  if (currentStep !== undefined && currentStep !== "❓ โหวตประหาร?") patch.voteDecision = null;
  if (Object.keys(patch).length) await patchWerewolfFb(code, patch as never);

  return NextResponse.json(updated);
}
