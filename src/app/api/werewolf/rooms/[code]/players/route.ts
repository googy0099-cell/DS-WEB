import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const room = await db.werewolfRoom.findUnique({ where: { code } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.gmId !== Number(session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const players = await db.werewolfRoomPlayer.findMany({
    where: { roomId: room.id },
    orderBy: { joinedAt: "asc" },
    include: { user: { select: { id: true, firstName: true, nickname: true, username: true } } },
  });

  return NextResponse.json(players);
}
