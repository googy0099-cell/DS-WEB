import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import type { App } from "firebase-admin/app";
import db from "@/lib/db";

let app: App | null = null;

function getFirebaseApp(): App | null {
  if (app) return app;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  if (getApps().length > 0) {
    app = getApp();
    return app;
  }
  app = initializeApp({ credential: cert(JSON.parse(raw)) });
  return app;
}

export async function sendFcmNotify(title: string, body: string): Promise<void> {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return;

  const tokens = await db.expoPushToken.findMany({ select: { token: true } });
  if (!tokens.length) return;

  const messaging = getMessaging(firebaseApp);

  await Promise.allSettled(
    tokens.map((t) =>
      messaging.send({
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
