import webpush from "web-push";
import db from "@/lib/db";

webpush.setVapidDetails(
  "mailto:admin@diceshop.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushToAll(title: string, body: string) {
  const { isTestModeActive } = await import("./test-mode");
  if (await isTestModeActive()) return; // suppress in test mode
  const subs = await db.pushSubscription.findMany();
  const payload = JSON.stringify({ title, body });
  await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      ).catch(async (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.pushSubscription.delete({ where: { endpoint: s.endpoint } }).catch(() => {});
        }
      })
    )
  );
}
