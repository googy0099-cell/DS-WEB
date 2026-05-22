import db from "@/lib/db";

let app: import("firebase-admin/app").App | null = null;

function getFirebaseApp() {
  if (app) return app;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const { initializeApp, cert, getApps } = require("firebase-admin/app");
  if (getApps().length > 0) { app = getApps()[0]; return app; }
  app = initializeApp({ credential: cert(JSON.parse(raw)) });
  return app;
}

export async function sendFcmNotify(title: string, body: string): Promise<void> {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return;

  const tokens = await db.expoPushToken.findMany({ select: { token: true } });
  if (!tokens.length) return;

  const { getMessaging } = require("firebase-admin/messaging");
  const messaging = getMessaging(firebaseApp);

  await Promise.allSettled(
    tokens.map((t) =>
      messaging.send({
        token: t.token,
        notification: { title, body },
        android: {
          priority: "high",
          notification: {
            channelId: "orders",
            sound: "default",
            defaultSound: true,
            vibrateTimingsMillis: [0, 250, 250, 250],
          },
        },
      })
    )
  );
}
