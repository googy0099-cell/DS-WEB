import db from "@/lib/db";

// Use main firebase-admin import (not sub-paths) to avoid Turbopack resolution issues
// firebase-admin is in serverExternalPackages — not bundled, loaded at runtime only
let initialized = false;

function initFirebase(): boolean {
  if (initialized) return true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return false;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require("firebase-admin") as typeof import("firebase-admin");
  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
  initialized = true;
  return true;
}

export async function sendFcmNotify(title: string, body: string): Promise<void> {
  if (!initFirebase()) return;

  const tokens = await db.expoPushToken.findMany({ select: { token: true } });
  if (!tokens.length) return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require("firebase-admin") as typeof import("firebase-admin");

  await Promise.allSettled(
    tokens.map((t) =>
      admin.messaging().send({
        token: t.token,
        data: { title, body, type: "NEW_ORDER" },
        android: {
          priority: "high",
          ttl: 60000,
          directBootOk: true,
          notification: {
            title,
            body,
            channelId: "orders",
            sound: "default",
            defaultSound: true,
            vibrateTimingsMillis: [0, 500, 500, 500],
            priority: "max",
            visibility: "public",
            defaultVibrateTimings: false,
            localOnly: false,
          },
        },
      })
    )
  );
}
