import { sendTelegramNotify } from "@/lib/telegram-notify";

export async function notifyCheckin(name: string, action: "checkin" | "checkout") {
  const bkk = new Date(Date.now() + 7 * 3600_000);
  const time = bkk.toISOString().slice(11, 16);
  const emoji = action === "checkin" ? "🟢" : "🔴";
  const label = action === "checkin" ? "เข้างาน" : "ออกงาน";
  await sendTelegramNotify(`${emoji} <b>${name}</b> ${label}\n🕐 ${time} น.`);
}
