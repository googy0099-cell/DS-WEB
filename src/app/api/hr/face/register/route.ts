import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { detectFace } from "@/lib/hr-azure-face";

export async function POST(req: NextRequest) {
  const { staffId, photos } = (await req.json()) as {
    staffId: number;
    photos: string[];
  };

  if (!staffId || !photos?.length) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const staff = await db.hrStaff.findUnique({ where: { id: staffId } });
  if (!staff) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });

  try {
    // Verify Azure can detect a face in every photo
    for (let i = 0; i < photos.length; i++) {
      const faceId = await detectFace(photos[i]);
      if (!faceId) {
        return NextResponse.json(
          { error: `รูปที่ ${i + 1} ตรวจจับใบหน้าไม่ได้ — แสงต้องดี ตรงกล้อง ชัด` },
          { status: 422 }
        );
      }
    }

    // Store all photos as JSON array in faceData
    await db.hrStaff.update({
      where: { id: staffId },
      data: { faceData: JSON.stringify(photos) },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
