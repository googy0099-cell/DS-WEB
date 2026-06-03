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

async function send(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
  }).catch(() => {});
}

export async function sendTelegramNotify(message: string) {
  await send(message);
}

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

export async function notifyBillClosed(opts: {
  billName: string;
  tableNumber: number;
  playerCount: number;
  packages: string;
  gameRevenue: number;
  foodRevenue: number;
  total: number;
  paymentMethod: string;
}) {
  const { billName, tableNumber, playerCount, packages, gameRevenue, foodRevenue, total, paymentMethod } = opts;
  const METHOD: Record<string, string> = { CASH: "💵 เงินสด", PROMPTPAY: "📲 QR PromptPay", TAB: "🏷️ แท็บ" };
  await send(
    `🎲 <b>ปิดตี้ — ${billName}</b>\n` +
    `📅 ${bkkDateLabel()}  ⏰ ${bkkTime()} น.\n` +
    `🪑 โต๊ะ ${tableNumber}   👥 ${playerCount} คน\n` +
    `🎮 ${packages}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `🎮 เกม:      ${thb(gameRevenue)}\n` +
    `🍽️ อาหาร:  ${thb(foodRevenue)}\n` +
    `💰 รวม:     ${thb(total)}\n` +
    `${METHOD[paymentMethod] ?? paymentMethod}`
  );
}
