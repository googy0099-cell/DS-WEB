import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { sendTelegramNotify } from "@/lib/telegram-notify";

const REDEEM_COST: Record<string, number> = { A: 10, B: 15 };
const REDEEM_LABEL: Record<string, string> = {
  A: "Package A — น้ำ 1 แก้ว + เล่นฟรี 1 ชม.",
  B: "Package B — เล่น 2 ชม.",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const userId = parseInt(session.user.id);
  const { packageType } = (await req.json()) as { packageType: string };

  const cost = REDEEM_COST[packageType];
  if (!cost) return NextResponse.json({ error: "ประเภทรางวัลไม่ถูกต้อง" }, { status: 400 });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, dicePoints: true, firstName: true, memberCode: true, username: true },
  });
  if (!user) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
  if (user.dicePoints < cost) return NextResponse.json({ error: `ลูกเต๋าของคุณไม่พอ (ต้องการ ${cost} ลูก)` }, { status: 400 });

  await db.user.update({ where: { id: userId }, data: { dicePoints: { decrement: cost } } });

  await sendTelegramNotify(
    `🎲 แลกรางวัล!\n👤 ${user.firstName} (@${user.username}) รหัส ${user.memberCode}\n🎁 ${REDEEM_LABEL[packageType]}\nใช้ ${cost} ลูกเต๋า`
  ).catch(() => {});

  return NextResponse.json({ ok: true, label: REDEEM_LABEL[packageType], cost });
}
