import { NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
