// Telegram notifications are split into two rooms (chats):
//   ORDER → ความเคลื่อนไหว/รายได้ของร้าน (ออเดอร์จ่ายแล้ว, เปิด-ปิดร้าน, เปิดปาร์ตี้, เช็คอิน)
//   TASK  → ติดตามงาน (นัดหมาย/ครบกำหนดจ่าย, งานใกล้ครบ deadline/KPI, สมาชิกใหม่)
// ORDER ใช้ TELEGRAM_CHAT_ID เดิม. TASK ใช้ TELEGRAM_CHAT_ID_TASK (ถ้าไม่ตั้ง = fallback ไปห้องเดิม).
export type TgChannel = "ORDER" | "TASK";

function bkkTime(d: Date = new Date()) {
  const bkk = new Date(d.getTime() + 7 * 3600_000);
  return bkk.toISOString().slice(11, 16);
}
function bkkDateLabel(d: Date = new Date()) {
  const bkk = new Date(d.getTime() + 7 * 3600_000);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${bkk.getUTCDate()} ${months[bkk.getUTCMonth()]} ${bkk.getUTCFullYear() + 543}`;
}
function thb(n: number) { return `฿${n.toLocaleString("th-TH")}`; }

const METHOD: Record<string, string> = {
  CASH: "💵 เงินสด", PROMPTPAY: "📲 QR PromptPay", TAB: "🏷️ แท็บ", UNSET: "💵 เงินสด",
};

function chatIdFor(channel: TgChannel): string | undefined {
  if (channel === "TASK") return process.env.TELEGRAM_CHAT_ID_TASK ?? process.env.TELEGRAM_CHAT_ID;
  return process.env.TELEGRAM_CHAT_ID;
}

async function send(message: string, channel: TgChannel = "ORDER"): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = chatIdFor(channel);
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
  }).catch(() => {});
}

export async function sendTelegramNotify(message: string, channel: TgChannel = "ORDER") {
  await send(message, channel);
}

// ─── ROOM: ORDER ──────────────────────────────────────────────────────────

export async function notifyShopOpen(openingFloat: number) {
  const now = new Date();
  await send(
    `🟢 <b>เปิดร้านแล้ว!</b>\n` +
    `📅 ${bkkDateLabel(now)}  ⏰ ${bkkTime(now)} น.\n` +
    `💵 เงินเปิดเก๊ะ ${thb(openingFloat)}`
  );
}

export async function notifyShopClose(opts: {
  cashTotal: number;
  transferTotal: number;
  grandTotal: number;
  difference: number;
  pettyExpenses: number;
}) {
  const { cashTotal, transferTotal, grandTotal, difference, pettyExpenses } = opts;
  const diffLabel = difference === 0 ? "✅ สมดุล" : difference > 0 ? `📈 เกิน ${thb(difference)}` : `📉 ขาด ${thb(Math.abs(difference))}`;
  let msg =
    `🔴 <b>ปิดยอดแล้ว</b>  ⏰ ${bkkTime()} น.\n` +
    `━━━━━━━━━━━━━━━\n` +
    `💵 เงินสด:   ${thb(cashTotal)}\n` +
    `💳 โอน/QR: ${thb(transferTotal)}\n` +
    `💰 รวม:     ${thb(grandTotal)}\n`;
  if (pettyExpenses > 0) msg += `🛍️ รายจ่ายเก๊ะ: ${thb(pettyExpenses)}\n`;
  msg += diffLabel;
  await send(msg);
}

// ออเดอร์ที่ "จ่ายเงินสำเร็จแล้ว" — รวมทั้งลูกค้าสั่งเอง, แท็บ, และพนักงานคีย์เอง
export async function notifyOrderPaid(opts: {
  orderLabel: string;   // ชื่อออเดอร์ หรือ "ตี้ X"
  location?: string;    // "โต๊ะ 3" / "ตี้ X · โต๊ะ 3" / ""
  itemLines: string;    // สรุปรายการ pre-formatted
  netTotal: number;     // ยอดสุทธิหลังหักส่วนลด
  method: string;       // CASH/PROMPTPAY/...
}) {
  const { orderLabel, location, itemLines, netTotal, method } = opts;
  await send(
    `✅ <b>รับชำระแล้ว</b>\n` +
    `🧾 ${orderLabel}${location ? ` · ${location}` : ""}\n` +
    `${itemLines}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `💰 รวมสุทธิ ${thb(netTotal)}   ${METHOD[method] ?? method}\n` +
    `⏰ ${bkkTime()} น.`
  );
}

export async function notifyPartyOpen(opts: { name: string; tableNumber: number }) {
  await send(
    `🎉 <b>เปิดปาร์ตี้</b> — ${opts.name}\n` +
    `🪑 โต๊ะ ${opts.tableNumber}  ⏰ ${bkkTime()} น.`
  );
}

// ─── ROOM: TASK ───────────────────────────────────────────────────────────

export async function notifyNewMember(opts: { name: string; memberCode: string; totalMembers: number }) {
  await send(
    `🎉 <b>สมาชิกใหม่!</b>\n` +
    `👤 ${opts.name} (${opts.memberCode})\n` +
    `📊 สมาชิกสะสมรวม ${opts.totalMembers.toLocaleString("th-TH")} คน`,
    "TASK"
  );
}
