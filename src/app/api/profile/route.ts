import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { nickname, phone, instagram, facebook, birthday, avatarUrl } = body;

  const data: Record<string, string | null> = {};
  if (nickname !== undefined) data.nickname = nickname || null;
  if (phone !== undefined) data.phone = phone || null;
  if (instagram !== undefined) data.instagram = instagram || null;
  if (facebook !== undefined) data.facebook = facebook || null;
  if (birthday !== undefined) data.birthday = birthday || null;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl || null;

  try {
    const updated = await db.user.update({
      where: { id: parseInt(session.user.id) },
      data,
    });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg.includes("Unique constraint") && msg.includes("phone")) {
      return NextResponse.json({ error: "เบอร์โทรนี้ถูกใช้แล้ว" }, { status: 400 });
    }
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
