import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { detectFace } from "@/lib/hr-azure-face";

export async function POST(req: NextRequest) {
  const { staffId, photoBase64 } = (await req.json()) as {
    staffId: number;
    photoBase64: string;
  };

  if (!staffId || !photoBase64) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const staff = await db.hrStaff.findUnique({ where: { id: staffId } });
  if (!staff) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });

  try {
    const faceId = await detectFace(photoBase64);
    if (!faceId) {
      return NextResponse.json({ error: "ตรวจจับใบหน้าไม่ได้ — แสงต้องดี ตรงกล้อง ไม่เบลอ" }, { status: 422 });
    }

    // Store reference photo in faceData field
    await db.hrStaff.update({ where: { id: staffId }, data: { faceData: photoBase64 } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
