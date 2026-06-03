import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";

export async function POST(req: NextRequest) {
  const { staffId } = (await req.json()) as { staffId: number };
  if (!staffId) return NextResponse.json({ error: "ไม่มี staffId" }, { status: 400 });

  const staff = await db.hrStaff.findUnique({ where: { id: staffId } });
  if (!staff) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = staff as any;
  if (!s.credentialId) {
    return NextResponse.json({ error: "ยังไม่ได้ลงทะเบียนนิ้ว" }, { status: 400 });
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
    allowCredentials: [
      { id: Buffer.from(s.credentialId as string, "base64url"), type: "public-key" },
    ],
  });

  await db.hrStaff.update({
    where: { id: staffId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { pendingChallenge: options.challenge } as any,
  });

  return NextResponse.json(options);
}
