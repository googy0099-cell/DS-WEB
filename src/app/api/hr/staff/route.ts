import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const staff = await db.hrStaff.findMany({
    include: {
      user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      attendances: {
        where: { checkIn: { gte: today }, checkOut: null },
        take: 1,
        orderBy: { checkIn: "desc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    staff.map((s) => ({
      id: s.id,
      userId: s.userId,
      name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      avatarUrl: s.user.avatarUrl,
      isCheckedIn: s.attendances.length > 0,
      faceData: s.faceData ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hasCredential: !!(s as any).credentialId,
    }))
  );
}

// OWNER: register a user as HrStaff and set their PIN
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, pin } = (await req.json()) as { userId: number; pin: string };

  if (!userId || !pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "ต้องระบุ userId และ PIN 4 หลัก" }, { status: 400 });
  }

  const pinHash = await bcrypt.hash(pin, 10);

  const existing = await db.hrStaff.findUnique({ where: { userId } });
  if (existing) {
    const updated = await db.hrStaff.update({ where: { userId }, data: { pin: pinHash } });
    return NextResponse.json(updated);
  }

  const hrStaff = await db.hrStaff.create({ data: { userId, pin: pinHash } });
  return NextResponse.json(hrStaff, { status: 201 });
}
