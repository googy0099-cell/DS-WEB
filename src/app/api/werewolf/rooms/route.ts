import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { generateUniqueRoomCode } from "@/lib/werewolf-room-code";

async function requireGM() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER" && session.user.role !== "CASHIER")) return null;
  return session;
}

export async function POST() {
  const session = await requireGM();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = await generateUniqueRoomCode();
  const room = await db.werewolfRoom.create({
    data: { code, gmId: Number(session.user.id) },
  });

  return NextResponse.json({ id: room.id, code: room.code });
}

export async function GET() {
  const session = await requireGM();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rooms = await db.werewolfRoom.findMany({
    where: { gmId: Number(session.user.id) },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      _count: { select: { players: true, games: true } },
      session: { select: { id: true, phase: true } },
    },
  });

  return NextResponse.json(rooms);
}
