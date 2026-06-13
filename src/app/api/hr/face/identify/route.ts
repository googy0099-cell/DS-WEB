import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { compareFaces } from "@/lib/hr-aws-face";
import { verifyToken } from "@/lib/hr-checkin-token";
import { notifyCheckin } from "@/lib/hr-notify";
import {
  computeCheckInStatus,
  computeCheckOutStatus,
  computeLateMinutes,
  computeLateDeductionAmount,
  getTodaySchedule,
} from "@/lib/hr-attendance";

const BKK = 7 * 3600_000;

export async function POST(req: NextRequest) {
  try {
  const { token, photoBase64, force, mode } = (await req.json()) as {
    token: string;
    photoBase64: string;
    force?: boolean;
    mode: "checkin" | "checkout";
  };

  if (!token || !photoBase64) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  // staffId is derived from the signed QR token — clients can't pick it directly.
  const staffId = verifyToken(token);
  if (!staffId) {
    return NextResponse.json(
      { error: "QR หมดอายุหรือไม่ถูกต้อง ลองสแกนใหม่" },
      { status: 401 }
    );
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

  // Identity passed → record attendance
  const now = new Date();
  const bkkNow = new Date(Date.now() + BKK);
  const dateStr = bkkNow.toISOString().slice(0, 10);
  const todayBKK = new Date(`${dateStr}T00:00:00+07:00`);
  const tomorrowBKK = new Date(todayBKK.getTime() + 86400_000);

  const schedule = await getTodaySchedule(staff.id, now);
  const staffName = `${staff.user.firstName} ${staff.user.lastName}`.trim();

  // ── CHECKOUT ────────────────────────────────────────────────────────────────
  if (mode === "checkout") {
    // Block checkout if CLOSE checklist is incomplete
    if (!force) {
      const closeChecklist = await db.hrChecklist.findFirst({
        where: { type: "CLOSE", date: { gte: todayBKK, lt: tomorrowBKK } },
        include: { items: { select: { done: true } } },
      });
      if (closeChecklist && closeChecklist.items.length > 0) {
        const doneCount = closeChecklist.items.filter((i) => i.done).length;
        const totalCount = closeChecklist.items.length;
        if (doneCount < totalCount) {
          const staffWithRole = await db.hrStaff.findUnique({ where: { id: staff.id }, include: { user: { select: { role: true } } } });
          return NextResponse.json({
            error: `เช็คลิสต์ปิดร้านยังไม่เสร็จ (${doneCount}/${totalCount} รายการ)`,
            checklistIncomplete: true,
            doneCount,
            totalCount,
            canForce: staffWithRole?.user.role === "OWNER",
            similarity: result.similarity,
          }, { status: 403 });
        }
      }
    }

    // Find the latest attendance record today (any — open or already closed)
    const latestRecord = await db.hrAttendance.findFirst({
      where: { staffId: staff.id, checkIn: { gte: todayBKK } },
      orderBy: { checkIn: "desc" },
    });
    if (!latestRecord) {
      return NextResponse.json({ error: "ยังไม่ได้เช็คอินวันนี้" }, { status: 404 });
    }

    const checkOutStatus = computeCheckOutStatus(now, schedule);
    const record = await db.hrAttendance.update({
      where: { id: latestRecord.id },
      data: { checkOut: now, photoUrl: photoBase64, checkOutStatus },
    });
    notifyCheckin(staffName, "checkout").catch(() => {});
    return NextResponse.json({
      action: "checkout",
      time: record.checkOut,
      staffName,
      status: checkOutStatus,
      similarity: result.similarity,
    });
  }

  // ── CHECKIN ──────────────────────────────────────────────────────────────────
  // One record per day — block if already checked in today
  const existingRecord = await db.hrAttendance.findFirst({
    where: { staffId: staff.id, checkIn: { gte: todayBKK } },
  });
  if (existingRecord) {
    return NextResponse.json({ error: "เช็คอินวันนี้ไปแล้ว" }, { status: 409 });
  }

  const checkInStatus = computeCheckInStatus(now, schedule);
  const record = await db.hrAttendance.create({
    data: {
      staffId: staff.id,
      checkIn: now,
      photoUrl: photoBase64,
      checkInStatus,
    },
  });

  // Auto-deduction for late check-in
  let lateDeductionAmount = 0;
  if (checkInStatus === "LATE") {
    try {
      const lateConfig = await db.hrLateConfig.findFirst();
      if (lateConfig && lateConfig.deductionAmount > 0) {
        const lateMinutes = computeLateMinutes(now, schedule);
        const amount = computeLateDeductionAmount(lateMinutes, lateConfig, {
          baseSalary: staff.baseSalary ?? 0,
          payType: staff.payType ?? "MONTHLY",
        });
        if (amount > 0) {
          const typeLabel = lateConfig.deductionType === "PERCENT" ? ` (${lateConfig.deductionAmount}%/นาที)` : "";
          const [dy, dm] = dateStr.split("-").map(Number); // BKK date of this check-in
          await db.hrDeduction.create({
            data: {
              staffId: staff.id,
              amount,
              reason: `เข้างานสาย ${lateMinutes} นาที${typeLabel}`,
              month: dm,
              year: dy,
              sourceType: "LATE",
              sourceId: `${staff.id}:${dateStr}`,
            },
          });
          await db.hrAttendance.update({
            where: { id: record.id },
            data: { lateDeductionApplied: true },
          });
          lateDeductionAmount = amount;
        }
      }
    } catch {
      // deduction failed — don't block check-in
    }
  }

  notifyCheckin(staffName, "checkin").catch(() => {});
  return NextResponse.json({
    action: "checkin",
    time: record.checkIn,
    staffName,
    status: checkInStatus,
    similarity: result.similarity,
    ...(lateDeductionAmount > 0 && { lateDeduction: lateDeductionAmount }),
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
