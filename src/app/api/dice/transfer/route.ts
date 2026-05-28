import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const senderId = parseInt(session.user.id);
  const { recipientCode, amount } = (await req.json()) as { recipientCode: string; amount: number };

  if (!recipientCode?.trim() || !amount || amount < 1 || !Number.isInteger(amount)) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const [sender, recipient] = await Promise.all([
    db.user.findUnique({ where: { id: senderId }, select: { id: true, dicePoints: true, memberCode: true } }),
    db.user.findUnique({ where: { memberCode: recipientCode.trim() }, select: { id: true, username: true, firstName: true } }),
  ]);

  if (!sender) return NextResponse.json({ error: "ไม่พบผู้ส่ง" }, { status: 404 });
  if (!recipient) return NextResponse.json({ error: "ไม่พบสมาชิกรหัส " + recipientCode }, { status: 404 });
  if (recipient.id === senderId) return NextResponse.json({ error: "ไม่สามารถโอนให้ตัวเองได้" }, { status: 400 });
  if (sender.dicePoints < amount) return NextResponse.json({ error: "ลูกเต๋าของคุณไม่พอ" }, { status: 400 });

  await db.$transaction([
    db.user.update({ where: { id: senderId }, data: { dicePoints: { decrement: amount } } }),
    db.user.update({ where: { id: recipient.id }, data: { dicePoints: { increment: amount } } }),
  ]);

  return NextResponse.json({ ok: true, recipientName: recipient.firstName });
}
