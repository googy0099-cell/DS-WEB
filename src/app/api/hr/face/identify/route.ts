import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { detectFace, verifyFaces } from "@/lib/hr-azure-face";
import { notifyCheckin } from "@/lib/hr-notify";

const CONFIDENCE_THRESHOLD = 0.6;

export async function POST(req: NextRequest) {
  const { photoBase64 } = (await req.json()) as { photoBase64: string };
  if (!photoBase64) return NextResponse.json({ error: "ไม่มีรูป" }, { status: 400 });

  // Detect face in the check-in photo
  let faceIdNew: string;
  try {
    faceIdNew = await detectFace(photoBase64);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "NO_FACE") {
      return NextResponse.json(
        { error: "ตรวจจับใบหน้าไม่พบ — ลองใหม่ใกล้ๆ กล้องกว่านี้" },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Load all staff that have a reference photo
  const allStaff = await db.hrStaff.findMany({
    where: { faceData: { not: null } },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  if (allStaff.length === 0) {
    return NextResponse.json({ error: "ยังไม่มีพนักงานลงทะเบียนใบหน้า" }, { status: 422 });
  }

  // Compare against each staff's reference photos (1 or 3)
  let best: { id: number; name: string; confidence: number } | null = null;

  for (const s of allStaff) {
    try {
      let refPhotos: string[];
      try {
        refPhotos = JSON.parse(s.faceData!);
        if (!Array.isArray(refPhotos)) refPhotos = [s.faceData!];
      } catch {
        refPhotos = [s.faceData!];
      }

      let maxConf = 0;
      for (const refPhoto of refPhotos) {
        try {
          const faceIdRef = await detectFace(refPhoto);
          const conf = await verifyFaces(faceIdNew, faceIdRef);
          if (conf > maxConf) maxConf = conf;
        } catch {
          continue;
        }
      }

      if (maxConf > (best?.confidence ?? 0)) {
        best = {
          id: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`.trim(),
          confidence: maxConf,
        };
      }
    } catch {
      continue;
    }
  }

  if (!best || best.confidence < CONFIDENCE_THRESHOLD) {
    return NextResponse.json(
      { error: `ระบุตัวตนไม่ได้ (best=${best ? best.confidence.toFixed(2) : "0"})` },
      { status: 422 }
    );
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
