import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });

  const { code } = await params;
  const { seatName } = await req.json();

  if (!seatName?.trim()) return NextResponse.json({ error: "กรุณาใส่ชื่อที่นั่ง" }, { status: 400 });

  const room = await db.werewolfRoom.findUnique({ where: { code } });
  if (!room) return NextResponse.json({ error: "ไม่พบห้องนี้" }, { status: 404 });
  if (!room.isOpen) return NextResponse.json({ error: "ห้องนี้ปิดแล้ว" }, { status: 400 });

  const existing = await db.werewolfRoomPlayer.findUnique({
    where: { roomId_userId: { roomId: room.id, userId: Number(session.user.id) } },
  });
  if (existing) return NextResponse.json({ error: "คุณ join ห้องนี้แล้ว", alreadyJoined: true }, { status: 409 });

  const player = await db.werewolfRoomPlayer.create({
    data: { roomId: room.id, userId: Number(session.user.id), seatName: seatName.trim() },
  });

  return NextResponse.json(player);
}
