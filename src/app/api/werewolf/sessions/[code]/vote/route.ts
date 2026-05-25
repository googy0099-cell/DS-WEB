import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number(session.user.id);

  const { targetUserId } = await req.json();
  if (!targetUserId) return NextResponse.json({ error: "ต้องระบุเป้าหมาย" }, { status: 400 });

  const room = await db.werewolfRoom.findUnique({
    where: { code },
    include: {
      session: {
        include: {
          playerRoles: true,
          votes: true,
        },
      },
    },
  });

  if (!room?.session) return NextResponse.json({ error: "ไม่พบ session" }, { status: 404 });
  const s = room.session;

  if (s.phase !== "PLAYING") return NextResponse.json({ error: "ไม่อยู่ในช่วงเกม" }, { status: 400 });
  if (!s.currentStep?.includes("🗳️")) return NextResponse.json({ error: "ยังไม่เปิดโหวต" }, { status: 400 });

  const sp = s.playerRoles.find((p) => p.userId === userId);
  if (!sp) return NextResponse.json({ error: "ไม่ได้อยู่ใน session นี้" }, { status: 403 });
  if (sp.status === "dead") return NextResponse.json({ error: "คุณตายไปแล้ว" }, { status: 400 });

  const alreadyVoted = s.votes.some((v) => v.voterUserId === userId && v.day === s.dayNumber);
  if (alreadyVoted) return NextResponse.json({ error: "โหวตแล้วในรอบนี้" }, { status: 400 });

  const target = s.playerRoles.find((p) => p.userId === targetUserId);
  if (!target || target.status === "dead") {
    return NextResponse.json({ error: "เป้าหมายไม่ถูกต้อง" }, { status: 400 });
  }

  await db.werewolfVote.upsert({
    where: { sessionId_day_voterUserId: { sessionId: s.id, day: s.dayNumber, voterUserId: userId } },
    create: { sessionId: s.id, day: s.dayNumber, voterUserId: userId, targetUserId },
    update: { targetUserId },
  });

  return NextResponse.json({ ok: true });
}
