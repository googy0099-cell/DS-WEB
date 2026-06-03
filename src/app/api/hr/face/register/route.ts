import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const { staffId, photo } = (await req.json()) as {
    staffId: number;
    photo: string;
  };

  if (!staffId || !photo) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const staff = await db.hrStaff.findUnique({ where: { id: staffId } });
  if (!staff) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });

  await db.hrStaff.update({
    where: { id: staffId },
    data: { faceData: photo },
  });

  return NextResponse.json({ ok: true });
}
