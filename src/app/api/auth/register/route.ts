import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { generateUniqueMemberCode } from "@/lib/member-code";

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, username, phone, email, password } =
      await req.json();

    if (!firstName || !lastName || !username || !email || !password) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบ" },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" },
        { status: 400 }
      );
    }

    const existing = await db.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      const field = existing.email === email ? "อีเมลนี้" : "Username นี้";
      return NextResponse.json(
        { error: `${field}ถูกใช้งานแล้ว` },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const memberCode = await generateUniqueMemberCode();

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        username,
        phone: phone || null,
        memberCode,
        role: "USER",
      },
    });

    return NextResponse.json({
      id: user.id,
      memberCode: user.memberCode,
      username: user.username,
    });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
