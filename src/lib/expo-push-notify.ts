import db from "@/lib/db";

export async function sendExpoPush(title: string, body: string): Promise<void> {
  const tokens = await db.expoPushToken.findMany({ select: { token: true } });
  if (!tokens.length) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    sound: "default",
    channelId: "orders",
    priority: "high",
  }));

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
}
