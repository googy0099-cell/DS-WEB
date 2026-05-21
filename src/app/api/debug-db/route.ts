import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const user = await db.user.findUnique({
      where: { email: "admin@diceshop.com" },
      select: { id: true, role: true, email: true },
    });
    return NextResponse.json({
      ok: true,
      adminFound: !!user,
      role: user?.role,
      urlPrefix: process.env.TURSO_DATABASE_URL?.slice(0, 10),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
