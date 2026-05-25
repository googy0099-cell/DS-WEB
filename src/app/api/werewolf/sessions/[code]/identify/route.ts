import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { patchWerewolfFb } from "@/lib/firebase-rtdb";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number(session.user.id);

  const room = await db.werewolfRoom.findUnique({ where: { code } });
  if (!room) return NextResponse.json({ error: "ไม่พบห้อง" }, { status: 404 });

  await patchWerewolfFb(code, { identify: { userId, at: Date.now() } } as never);
  return NextResponse.json({ ok: true });
}
