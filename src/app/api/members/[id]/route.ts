import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

async function requireOwner() {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireOwner())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const { firstName, lastName, nickname, email, phone, instagram, facebook, birthday, dicePoints, newPassword } = body;

  const data: Record<string, string | number | null | undefined> = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (nickname !== undefined) data.nickname = nickname || null;
  if (email !== undefined) data.email = email;
  if (phone !== undefined) data.phone = phone || null;
  if (instagram !== undefined) data.instagram = instagram || null;
  if (facebook !== undefined) data.facebook = facebook || null;
  if (birthday !== undefined) data.birthday = birthday || null;
  if (dicePoints !== undefined) data.dicePoints = Number(dicePoints);
  if (newPassword && typeof newPassword === "string" && newPassword.length >= 6) {
    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  try {
    const user = await db.user.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ ok: true, id: user.id });
  } catch {
    return NextResponse.json({ error: "อัพเดทไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireOwner())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { id } = await params;
  try {
    await db.user.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "ลบไม่สำเร็จ" }, { status: 500 });
  }
}
