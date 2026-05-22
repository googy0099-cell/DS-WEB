import { createSign } from "crypto";
import db from "@/lib/db";

async function getFcmAccessToken(sa: {
  client_email: string;
  private_key: string;
}): Promise<string> {
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
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function sendFcmNotify(title: string, body: string): Promise<void> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return;

  const all = await db.expoPushToken.findMany({ select: { token: true } });
  // ExponentPushToken[...] คือ Expo format ใช้กับ FCM HTTP v1 ไม่ได้
  const tokens = all.filter((t) => !t.token.startsWith("ExponentPushToken["));
  if (!tokens.length) return;

  const sa = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
  const accessToken = await getFcmAccessToken(sa);

  await Promise.allSettled(
    tokens.map((t) =>
      fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          message: {
            token: t.token,
            // data-only (no notification field) → Android calls onMessageReceived()
            // even when app is killed → DiceShopMessagingService starts AlarmActivity
            data: { title, body, type: "NEW_ORDER" },
            android: {
              priority: "HIGH",
              ttl: "60s",
              direct_boot_ok: true,
            },
          },
        }),
      })
    )
  );
}
