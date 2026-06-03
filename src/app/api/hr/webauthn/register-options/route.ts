import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generateRegistrationOptions } from "@simplewebauthn/server";

const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const RP_NAME = "Dice Shop HR";

export async function POST(req: NextRequest) {
  const { staffId } = (await req.json()) as { staffId: number };
  if (!staffId) return NextResponse.json({ error: "ไม่มี staffId" }, { status: 400 });

  const staff = await db.hrStaff.findUnique({
    where: { id: staffId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!staff) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = staff as any;
  const existingCredentials = s.credentialId
    ? [{ id: Buffer.from(s.credentialId as string, "base64url"), type: "public-key" as const }]
    : [];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: String(staff.userId),
    userName: `${staff.user.firstName} ${staff.user.lastName}`.trim(),
    attestationType: "none",
    excludeCredentials: existingCredentials,
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      requireResidentKey: false,
      userVerification: "required",
    },
  });

  await db.hrStaff.update({
    where: { id: staffId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { pendingChallenge: options.challenge } as any,
  });

  return NextResponse.json(options);
}
