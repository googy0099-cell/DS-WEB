import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { getTeam } from "@/lib/werewolf-roles";
import { patchWerewolfFb } from "@/lib/firebase-rtdb";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!(await requireGM())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, role } = await req.json() as { userId: number; role: string };
  if (!userId || typeof role !== "string") {
    return NextResponse.json({ error: "ต้องระบุ userId และ role" }, { status: 400 });
  }

  const room = await db.werewolfRoom.findUnique({ where: { code }, include: { session: true } });
  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });

  const team = getTeam(role);
  await db.werewolfSessionPlayer.updateMany({
    where: { sessionId: room.session.id, userId },
    data: { role, team },
  });

  // Touch Firebase so the affected player's listener re-fetches /me immediately.
  // (Roles are private — they flow via /me, not the shared Firebase node.)
  await patchWerewolfFb(code, { rolesUpdatedAt: Date.now() } as never);

  return NextResponse.json({ ok: true });
}
