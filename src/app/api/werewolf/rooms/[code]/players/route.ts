import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

async function requireGM(code: string) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  const room = await db.werewolfRoom.findUnique({ where: { code } });
  if (!room || room.gmId !== Number(session.user.id)) return null;
  return { session, room };
}

// GET — list players in room
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const gm = await requireGM(code);
  if (!gm) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const players = await db.werewolfRoomPlayer.findMany({
    where: { roomId: gm.room.id },
    orderBy: { joinedAt: "asc" },
    include: { user: { select: { id: true, firstName: true, nickname: true, username: true } } },
  });

  return NextResponse.json(players);
}

// POST — GM manually adds a member by userId (card player without phone)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const gm = await requireGM(code);
  if (!gm) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, seatName } = await req.json();
  if (!userId || !seatName?.trim()) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  const user = await db.user.findUnique({ where: { id: Number(userId) } });
  if (!user) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });

  const existing = await db.werewolfRoomPlayer.findUnique({
    where: { roomId_userId: { roomId: gm.room.id, userId: Number(userId) } },
  });
  if (existing) return NextResponse.json({ error: "สมาชิกนี้อยู่ในห้องแล้ว" }, { status: 409 });

  const player = await db.werewolfRoomPlayer.create({
    data: { roomId: gm.room.id, userId: Number(userId), seatName: seatName.trim() },
    include: { user: { select: { id: true, firstName: true, nickname: true, username: true } } },
  });

  return NextResponse.json(player);
}

// PATCH — GM updates seat names (batch: [{userId, seatName}])
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const gm = await requireGM(code);
  if (!gm) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { updates } = await req.json() as { updates: { userId: number; seatName: string }[] };
  if (!Array.isArray(updates)) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await Promise.all(
    updates.map((u) =>
      db.werewolfRoomPlayer.update({
        where: { roomId_userId: { roomId: gm.room.id, userId: u.userId } },
        data: { seatName: u.seatName.trim() },
      })
    )
  );

  return NextResponse.json({ ok: true });
}

// DELETE — GM removes a player from room
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const gm = await requireGM(code);
  if (!gm) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await req.json();
  await db.werewolfRoomPlayer.deleteMany({
    where: { roomId: gm.room.id, userId: Number(userId) },
  });

  return NextResponse.json({ ok: true });
}
