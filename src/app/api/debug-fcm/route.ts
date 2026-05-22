import { NextResponse } from "next/server";
import { createSign } from "crypto";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const result: Record<string, unknown> = {};

  // 1. Check env var
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  result.hasEnvVar = !!raw;
  if (!raw) return NextResponse.json(result);

  // 2. Parse service account
  let sa: { project_id: string; client_email: string; private_key: string };
  try {
    sa = JSON.parse(raw);
    result.projectId = sa.project_id;
    result.clientEmail = sa.client_email;
    result.hasPrivateKey = !!sa.private_key;
  } catch (e) {
    result.parseError = String(e);
    return NextResponse.json(result);
  }

  // 3. Check tokens in DB
  const tokens = await db.expoPushToken.findMany({ select: { token: true } });
  result.tokenCount = tokens.length;
  result.tokens = tokens.map((t) => t.token.slice(0, 20) + "...");

  // 4. Try get access token
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claim = Buffer.from(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })
    ).toString("base64url");
    const sign = createSign("RSA-SHA256");
    sign.update(`${header}.${claim}`);
    const jwt = `${header}.${claim}.${sign.sign(sa.private_key, "base64url")}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    });
    const tokenData = await tokenRes.json() as Record<string, unknown>;
    result.tokenStatus = tokenRes.status;
    result.accessTokenOk = !!tokenData.access_token;
    if (!tokenData.access_token) result.tokenError = tokenData;

    // 5. Try send to first token if any
    if (tokenData.access_token && tokens.length > 0) {
      const fcmRes = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenData.access_token}`,
          },
          body: JSON.stringify({
            message: {
              token: tokens[0].token,
              data: { title: "🔔 ทดสอบ", body: "test notification", type: "NEW_ORDER" },
              android: { priority: "HIGH" },
            },
          }),
        }
      );
      const fcmData = await fcmRes.json();
      result.fcmStatus = fcmRes.status;
      result.fcmResponse = fcmData;
    }
  } catch (e) {
    result.jwtError = String(e);
  }

  return NextResponse.json(result, { status: 200 });
}
