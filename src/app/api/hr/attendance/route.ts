import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { notifyCheckin } from "@/lib/hr-notify";

export async function POST(req: NextRequest) {
  const { staffId, pin, photoBase64 } = (await req.json()) as {
    staffId: number;
    pin: string;
    photoBase64?: string;
  };

  if (!staffId || !pin) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const staff = await db.hrStaff.findUnique({
    where: { id: staffId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!staff?.pin) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้ง PIN" }, { status: 400 });
  }

  const valid = await bcrypt.compare(pin, staff.pin);
  if (!valid) {
    return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openRecord = await db.hrAttendance.findFirst({
    where: { staffId, checkIn: { gte: today }, checkOut: null },
    orderBy: { checkIn: "desc" },
  });

  const fullName = `${staff.user.firstName} ${staff.user.lastName}`.trim();

  if (openRecord) {
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
