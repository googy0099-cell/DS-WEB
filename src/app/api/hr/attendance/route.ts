import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { notifyCheckin } from "@/lib/hr-notify";

const BKK = 7 * 3600_000;

export async function POST(req: NextRequest) {
  const { staffId, pin, photoBase64, faceCheckin, force } = (await req.json()) as {
    staffId: number;
    pin?: string;
    photoBase64?: string;
    faceCheckin?: boolean;
    force?: boolean;
  };

  if (!staffId) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  const staff = await db.hrStaff.findUnique({
    where: { id: staffId },
    include: { user: { select: { firstName: true, lastName: true, role: true } } },
  });

  if (!staff) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });

  if (faceCheckin) {
    if (!staff.faceData) return NextResponse.json({ error: "ยังไม่ได้ลงทะเบียนใบหน้า" }, { status: 400 });
  } else {
    if (!staff.pin) return NextResponse.json({ error: "ยังไม่ได้ตั้ง PIN" }, { status: 400 });
    const valid = await bcrypt.compare(pin ?? "", staff.pin);
    if (!valid) return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openRecord = await db.hrAttendance.findFirst({
    where: { staffId, checkIn: { gte: today }, checkOut: null },
    orderBy: { checkIn: "desc" },
  });

  const fullName = `${staff.user.firstName} ${staff.user.lastName}`.trim();
  const isOwner = staff.user.role === "OWNER";

  if (openRecord) {
    // Checkout — check if CLOSE checklist is complete
    if (!force) {
      const bkkNow = new Date(Date.now() + BKK);
      const dateStr = bkkNow.toISOString().slice(0, 10);
      const todayBKK = new Date(`${dateStr}T00:00:00+07:00`);
      const tomorrowBKK = new Date(todayBKK.getTime() + 86400_000);

      const closeChecklist = await db.hrChecklist.findFirst({
        where: { type: "CLOSE", date: { gte: todayBKK, lt: tomorrowBKK } },
        include: { items: { select: { done: true } } },
      });

      if (closeChecklist && closeChecklist.items.length > 0) {
        const doneCount = closeChecklist.items.filter((i) => i.done).length;
        const totalCount = closeChecklist.items.length;
        if (doneCount < totalCount) {
          return NextResponse.json({
            error: `เช็คลิสต์ปิดร้านยังไม่เสร็จ (${doneCount}/${totalCount} รายการ)`,
            checklistIncomplete: true,
            doneCount,
            totalCount,
            canForce: isOwner,
          }, { status: 403 });
        }
      }
    }

    const record = await db.hrAttendance.update({
      where: { id: openRecord.id },
      data: { checkOut: new Date(), photoUrl: photoBase64 ?? null },
    });
    notifyCheckin(fullName, "checkout").catch(() => {});
    return NextResponse.json({ action: "checkout", time: record.checkOut });
  } else {
    const record = await db.hrAttendance.create({
      data: { staffId, checkIn: new Date(), photoUrl: photoBase64 ?? null },
    });
    notifyCheckin(fullName, "checkin").catch(() => {});
    return NextResponse.json({ action: "checkin", time: record.checkIn });
  }
}
