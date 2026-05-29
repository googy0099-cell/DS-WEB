import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER" && session.user.role !== "CASHIER")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const code = new URL(req.url).searchParams.get("code")?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "ต้องระบุรหัสสมาชิก" }, { status: 400 });

  const member = await db.user.findUnique({
    where: { memberCode: code },
    select: { id: true, username: true, memberCode: true, firstName: true },
  });

  if (!member) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });

  return NextResponse.json(member);
}
