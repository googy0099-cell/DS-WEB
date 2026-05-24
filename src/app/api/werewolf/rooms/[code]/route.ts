import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: { _count: { select: { players: true } }, gm: { select: { username: true, firstName: true } } },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: room.id,
    code: room.code,
    isOpen: room.isOpen,
    playerCount: room._count.players,
    gmName: room.gm.firstName || room.gm.username,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const { isOpen } = await req.json();

  const room = await db.werewolfRoom.findUnique({ where: { code } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.gmId !== Number(session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await db.werewolfRoom.update({
    where: { code },
    data: { isOpen },
  });

  return NextResponse.json(updated);
}
