import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { generateUniqueMemberCode } from "@/lib/member-code";
import { Prisma } from "@prisma/client";

async function requireOwner() {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") return null;
  return session;
}

export async function GET() {
  if (!(await requireOwner())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const users = await db.user.findMany({
    where: { role: { in: ["CASHIER", "STAFF", "OWNER"] } },
    select: {
      id: true, email: true, username: true, firstName: true, lastName: true, role: true, createdAt: true,
      hrStaff: { select: { id: true, pin: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    users.map((u) => ({
      ...u,
      hrStaff: u.hrStaff ? { id: u.hrStaff.id, hasPin: !!u.hrStaff.pin } : null,
    }))
  );
}

export async function POST(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { email, password, firstName, lastName, username, role } = await req.json();
  if (!email || !password || !firstName || !lastName || !username) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const memberCode = await generateUniqueMemberCode();
  try {
    const user = await db.user.create({
      data: { email, passwordHash, firstName, lastName, username, memberCode, role: role ?? "STAFF" },
    });
    return NextResponse.json({ id: user.id, email: user.email, role: user.role }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const fields = (e.meta?.target as string[] | undefined) ?? [];
      if (fields.includes("email")) return NextResponse.json({ error: "อีเมลนี้มีในระบบแล้ว" }, { status: 409 });
      if (fields.includes("username")) return NextResponse.json({ error: "Username นี้มีในระบบแล้ว" }, { status: 409 });
      return NextResponse.json({ error: "ข้อมูลซ้ำกับที่มีอยู่แล้ว" }, { status: 409 });
    }
    throw e;
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const body = await req.json();
  const { id, role, firstName, lastName, email, username } = body;
  const data: Record<string, string> = {};
  if (role) data.role = role;
  if (firstName) data.firstName = firstName;
  if (lastName) data.lastName = lastName;
  if (email) data.email = email;
  if (username) data.username = username;
  const user = await db.user.update({ where: { id }, data });
  return NextResponse.json({ id: user.id, role: user.role });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { id } = await req.json();
  await db.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
