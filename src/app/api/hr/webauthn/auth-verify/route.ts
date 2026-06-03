import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { notifyCheckin } from "@/lib/hr-notify";

const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const { staffId, credential } = (await req.json()) as {
    staffId: number;
    credential: AuthenticationResponseJSON;
  };

  const staff = await db.hrStaff.findUnique({
    where: { id: staffId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = staff as any;
  if (!s?.pendingChallenge || !s.credentialId || !s.credentialPublicKey) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: s.pendingChallenge as string,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      authenticator: {
        credentialID: Buffer.from(s.credentialId as string, "base64url"),
        credentialPublicKey: Buffer.from(s.credentialPublicKey as string, "base64url"),
        counter: s.credentialCounter as number,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "ยืนยันไม่สำเร็จ" }, { status: 401 });
  }

  await db.hrStaff.update({
    where: { id: staffId },
    data: {
      credentialCounter: verification.authenticationInfo.newCounter,
      pendingChallenge: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });

  // Record attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openRecord = await db.hrAttendance.findFirst({
    where: { staffId, checkIn: { gte: today }, checkOut: null },
    orderBy: { checkIn: "desc" },
  });

  const fullName = `${staff!.user.firstName} ${staff!.user.lastName}`.trim();

  if (openRecord) {
    const record = await db.hrAttendance.update({
      where: { id: openRecord.id },
      data: { checkOut: new Date() },
    });
    notifyCheckin(fullName, "checkout").catch(() => {});
    return NextResponse.json({ action: "checkout", time: record.checkOut });
  } else {
    const record = await db.hrAttendance.create({
      data: { staffId, checkIn: new Date() },
    });
    notifyCheckin(fullName, "checkin").catch(() => {});
    return NextResponse.json({ action: "checkin", time: record.checkIn });
  }
}
