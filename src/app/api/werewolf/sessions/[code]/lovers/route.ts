import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { patchWerewolfFb } from "@/lib/firebase-rtdb";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER" && session.user.role !== "CASHIER")) return null;
  return session;
}

// Cupid (กามเทพ): the GM records the two lovers. They are stored in Firebase and read at every
// death resolution so that when one lover dies, the other dies of heartbreak.
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!(await requireGM())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userIds } = await req.json();
  if (!Array.isArray(userIds) || userIds.length !== 2 || userIds.some((n) => typeof n !== "number")) {
    return NextResponse.json({ error: "ต้องเลือกคู่รัก 2 คน" }, { status: 400 });
  }

  const room = await db.werewolfRoom.findUnique({ where: { code }, include: { session: { select: { id: true } } } });
  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });

  await patchWerewolfFb(code, { lovers: userIds } as never);
  return NextResponse.json({ ok: true, lovers: userIds });
}
