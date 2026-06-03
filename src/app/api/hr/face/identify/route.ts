import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { detectFace, verifyFaces } from "@/lib/hr-azure-face";
import { notifyCheckin } from "@/lib/hr-notify";

const CONFIDENCE_THRESHOLD = 0.6;

export async function POST(req: NextRequest) {
  const { photoBase64 } = (await req.json()) as { photoBase64: string };
  if (!photoBase64) return NextResponse.json({ error: "ไม่มีรูป" }, { status: 400 });

  // Detect face in the check-in photo
  let faceIdNew: string | null;
  try {
    faceIdNew = await detectFace(photoBase64);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  if (!faceIdNew) {
    return NextResponse.json({ error: "ตรวจจับใบหน้าไม่พบ — ลองใหม่ใกล้ๆ กล้องกว่านี้" }, { status: 422 });
  }

  // Load all staff that have a reference photo
  const allStaff = await db.hrStaff.findMany({
    where: { faceData: { not: null } },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  if (allStaff.length === 0) {
    return NextResponse.json({ error: "ยังไม่มีพนักงานลงทะเบียนใบหน้า" }, { status: 422 });
  }

  // Compare against each staff's reference photo
  let best: { id: number; name: string; confidence: number } | null = null;

  for (const s of allStaff) {
    try {
      const faceIdRef = await detectFace(s.faceData!);
      if (!faceIdRef) continue;
      const confidence = await verifyFaces(faceIdNew, faceIdRef);
      if (confidence > (best?.confidence ?? 0)) {
        best = {
          id: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`.trim(),
          confidence,
        };
      }
    } catch {
      continue;
    }
  }

  if (!best || best.confidence < CONFIDENCE_THRESHOLD) {
    return NextResponse.json({ error: "ระบุตัวตนไม่ได้ — ลองใหม่หรือใช้ PIN" }, { status: 422 });
  }

  // Record attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openRecord = await db.hrAttendance.findFirst({
    where: { staffId: best.id, checkIn: { gte: today }, checkOut: null },
    orderBy: { checkIn: "desc" },
  });

  if (openRecord) {
    const record = await db.hrAttendance.update({
      where: { id: openRecord.id },
      data: { checkOut: new Date(), photoUrl: photoBase64 },
    });
    notifyCheckin(best.name, "checkout").catch(() => {});
    return NextResponse.json({ action: "checkout", time: record.checkOut, staffName: best.name, confidence: best.confidence });
  } else {
    const record = await db.hrAttendance.create({
      data: { staffId: best.id, checkIn: new Date(), photoUrl: photoBase64 },
    });
    notifyCheckin(best.name, "checkin").catch(() => {});
    return NextResponse.json({ action: "checkin", time: record.checkIn, staffName: best.name, confidence: best.confidence });
  }
}
