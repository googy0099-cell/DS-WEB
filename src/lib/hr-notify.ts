import { sendLineNotify } from "@/lib/line-notify";

export async function notifyCheckin(name: string, action: "checkin" | "checkout") {
  const now = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const emoji = action === "checkin" ? "🟢" : "🔴";
  const label = action === "checkin" ? "เข้างาน" : "ออกงาน";
  await sendLineNotify(`\n${emoji} ${name} ${label}\n🕐 ${now} น.`);
}
