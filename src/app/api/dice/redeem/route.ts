import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { sendTelegramNotify } from "@/lib/telegram-notify";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "STAFF" && session.user.role !== "CASHIER" && session.user.role !== "OWNER")
  ) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const { memberCode, rewardId } = (await req.json()) as { memberCode: string; rewardId: number };
  if (!memberCode?.trim() || !rewardId) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const member = await db.user.findUnique({
    where: { memberCode: memberCode.trim().toUpperCase() },
    select: { id: true, firstName: true, username: true, memberCode: true, dicePoints: true },
  });
  if (!member) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });

  const reward = await db.rewardItem.findUnique({ where: { id: rewardId } });
  if (!reward || !reward.isAvailable) {
    return NextResponse.json({ error: "ไม่พบรางวัล" }, { status: 404 });
  }

  if (member.dicePoints < reward.cost) {
    return NextResponse.json({ error: `แต้มไม่พอ (มี ${member.dicePoints} ต้องการ ${reward.cost} 🎲)` }, { status: 400 });
  }

  await db.user.update({
    where: { id: member.id },
    data: { dicePoints: { decrement: reward.cost } },
  });

  await sendTelegramNotify(
    `🎲 แลกรางวัล!\n👤 ${member.firstName} (@${member.username}) รหัส ${member.memberCode}\n🎁 ${reward.nameTh}\nใช้ ${reward.cost} 🎲 | เหลือ ${member.dicePoints - reward.cost} 🎲\nยืนยันโดย: ${session.user.name ?? session.user.email}`
  ).catch(() => {});

  return NextResponse.json({ ok: true, memberName: member.firstName, rewardName: reward.nameTh, cost: reward.cost, remaining: member.dicePoints - reward.cost });
}
