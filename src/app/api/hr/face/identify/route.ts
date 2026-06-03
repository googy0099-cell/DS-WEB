import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { detectFace, identifyFace } from "@/lib/hr-azure-face";
import { notifyCheckin } from "@/lib/hr-notify";

export async function POST(req: NextRequest) {
  const { photoBase64 } = (await req.json()) as { photoBase64: string };
  if (!photoBase64) return NextResponse.json({ error: "ไม่มีรูป" }, { status: 400 });

  const faceId = await detectFace(photoBase64);
  if (!faceId) {
    return NextResponse.json({ error: "ตรวจจับใบหน้าไม่พบ" }, { status: 422 });
  }

  const result = await identifyFace(faceId);
  if (!result || result.confidence < 0.6) {
    return NextResponse.json({ error: "ระบุตัวตนไม่ได้" }, { status: 422 });
  }

  const staff = await db.hrStaff.findFirst({
    where: { azurePersonId: result.personId } as never,
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!staff) return NextResponse.json({ error: "ไม่พบพนักงานในระบบ" }, { status: 404 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openRecord = await db.hrAttendance.findFirst({
    where: { staffId: staff.id, checkIn: { gte: today }, checkOut: null },
    orderBy: { checkIn: "desc" },
  });

  const fullName = `${staff.user.firstName} ${staff.user.lastName}`.trim();

  if (openRecord) {
    const record = await db.hrAttendance.update({
      where: { id: openRecord.id },
      data: { checkOut: new Date(), photoUrl: photoBase64 },
    });
    notifyCheckin(fullName, "checkout").catch(() => {});
    return NextResponse.json({ action: "checkout", time: record.checkOut, staffName: fullName, confidence: result.confidence });
  } else {
    const record = await db.hrAttendance.create({
      data: { staffId: staff.id, checkIn: new Date(), photoUrl: photoBase64 },
    });
    notifyCheckin(fullName, "checkin").catch(() => {});
    return NextResponse.json({ action: "checkin", time: record.checkIn, staffName: fullName, confidence: result.confidence });
  }
}
