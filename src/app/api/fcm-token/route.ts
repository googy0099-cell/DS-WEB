import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }
  await db.expoPushToken.upsert({
    where: { token },
    create: { token },
    update: {},
  });
  return NextResponse.json({ ok: true });
}
