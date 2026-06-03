import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";

const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const { staffId, credential } = (await req.json()) as {
    staffId: number;
    credential: RegistrationResponseJSON;
  };

  const staff = await db.hrStaff.findUnique({ where: { id: staffId } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = staff as any;
  if (!s?.pendingChallenge) {
    return NextResponse.json({ error: "ไม่มี challenge" }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: s.pendingChallenge as string,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "ยืนยันไม่สำเร็จ" }, { status: 400 });
  }

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

  await db.hrStaff.update({
    where: { id: staffId },
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      credentialId: Buffer.from(credentialID).toString("base64url"),
      credentialPublicKey: Buffer.from(credentialPublicKey).toString("base64url"),
      credentialCounter: counter,
      pendingChallenge: null,
    } as any,
  });

  return NextResponse.json({ ok: true });
}
