import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { compareFaces } from "@/lib/hr-aws-face";
import { notifyCheckin } from "@/lib/hr-notify";
import {
  computeCheckInStatus,
  computeCheckOutStatus,
  getTodaySchedule,
} from "@/lib/hr-attendance";

export async function POST(req: NextRequest) {
  const { staffId, photoBase64 } = (await req.json()) as {
    staffId: number;
    photoBase64: string;
  };

  if (!staffId || !photoBase64) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const staff = await db.hrStaff.findUnique({
    where: { id: staffId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!staff) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });
  if (!staff.faceData) {
    return NextResponse.json(
      { error: "พนักงานยังไม่ได้ลงทะเบียนใบหน้า" },
      { status: 422 }
    );
  }

  // Compare scanned face vs stored reference via AWS Rekognition
  let result: { similarity: number; matched: boolean };
  try {
    result = await compareFaces(staff.faceData, photoBase64);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `AWS: ${msg}` }, { status: 500 });
  }

  if (!result.matched) {
    return NextResponse.json(
      {
        error: `ตัวตนไม่ตรง — similarity ${result.similarity.toFixed(1)}%`,
        similarity: result.similarity,
      },
      { status: 422 }
    );
  }

  // Identity passed → record attendance with punctuality status
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const schedule = await getTodaySchedule(staff.id, now);
  const staffName = `${staff.user.firstName} ${staff.user.lastName}`.trim();

  const openRecord = await db.hrAttendance.findFirst({
    where: { staffId: staff.id, checkIn: { gte: today }, checkOut: null },
    orderBy: { checkIn: "desc" },
  });

  if (openRecord) {
    const status = computeCheckOutStatus(now, schedule);
    const record = await db.hrAttendance.update({
      where: { id: openRecord.id },
      data: { checkOut: now, photoUrl: photoBase64, checkOutStatus: status },
    });
    notifyCheckin(staffName, "checkout").catch(() => {});
    return NextResponse.json({
      action: "checkout",
      time: record.checkOut,
      staffName,
      status,
      similarity: result.similarity,
    });
  }

  const status = computeCheckInStatus(now, schedule);
  const record = await db.hrAttendance.create({
    data: {
      staffId: staff.id,
      checkIn: now,
      photoUrl: photoBase64,
      checkInStatus: status,
    },
  });
  notifyCheckin(staffName, "checkin").catch(() => {});
  return NextResponse.json({
    action: "checkin",
    time: record.checkIn,
    staffName,
    status,
    similarity: result.similarity,
  });
}
