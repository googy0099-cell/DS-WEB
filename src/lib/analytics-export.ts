import { createSign } from "crypto";
import db from "@/lib/db";

// ─── helpers ────────────────────────────────────────────────────────────────

function bkkDate(d: Date) {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}
function bkkDateTime(d: Date) {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
}
function parseDateRange(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return {
    start: new Date(Date.UTC(fy, fm - 1, fd, -7, 0, 0)),
    end: new Date(Date.UTC(ty, tm - 1, td + 1, -7, 0, 0)),
  };
}
function fillDates(from: string, to: string) {
  const dates: string[] = [];
  const cur = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cur <= end) { dates.push(cur.toISOString().slice(0, 10)); cur.setUTCDate(cur.getUTCDate() + 1); }
  return dates;
}

export function csvEscape(v: string | number | null | undefined) {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}
export function buildCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

// ─── data fetchers ──────────────────────────────────────────────────────────

export async function fetchSalesRows(from: string, to: string) {
  const { start, end } = parseDateRange(from, to);
  const orders = await db.order.findMany({
    where: { status: "SERVED", createdAt: { gte: start, lt: end } },
    select: { totalTHB: true, createdAt: true },
  });
  const map: Record<string, { revenue: number; count: number }> = {};
  for (const d of fillDates(from, to)) map[d] = { revenue: 0, count: 0 };
  for (const o of orders) {
    const k = bkkDate(o.createdAt);
    if (map[k]) { map[k].revenue += o.totalTHB; map[k].count++; }
  }
  const header = ["วันที่", "รายได้ (บาท)", "จำนวนบิล"];
  const rows = Object.entries(map).map(([date, v]) => [date, v.revenue, v.count]);
  return { header, rows, sheetName: "ยอดขายรายวัน" };
}

export async function fetchMenuRows(from: string, to: string) {
  const { start, end } = parseDateRange(from, to);
  const items = await db.orderItem.findMany({
    where: { order: { status: "SERVED", createdAt: { gte: start, lt: end } }, menuItem: { category: { not: "gametime" } } },
    select: { quantity: true, unitPriceTHB: true, menuItem: { select: { nameTh: true } } },
  });
  const map = new Map<string, { qty: number; total: number }>();
  for (const i of items) {
    const cur = map.get(i.menuItem.nameTh) ?? { qty: 0, total: 0 };
    cur.qty += i.quantity; cur.total += i.quantity * i.unitPriceTHB;
    map.set(i.menuItem.nameTh, cur);
  }
  const header = ["ชื่อเมนู", "จำนวนชิ้น", "ยอดเงิน (บาท)"];
  const rows = [...map.entries()].sort((a, b) => b[1].qty - a[1].qty).map(([name, v]) => [name, v.qty, v.total]);
  return { header, rows, sheetName: "เมนูขายดี" };
}

export async function fetchGametimeRows(from: string, to: string) {
  const { start, end } = parseDateRange(from, to);
  const items = await db.orderItem.findMany({
    where: { order: { status: "SERVED", createdAt: { gte: start, lt: end } }, menuItem: { category: "gametime" } },
    select: { quantity: true, unitPriceTHB: true, menuItem: { select: { nameTh: true } } },
  });
  const map = new Map<string, { qty: number; total: number }>();
  for (const i of items) {
    const cur = map.get(i.menuItem.nameTh) ?? { qty: 0, total: 0 };
    cur.qty += i.quantity; cur.total += i.quantity * i.unitPriceTHB;
    map.set(i.menuItem.nameTh, cur);
  }
  const header = ["ชื่อแพ็กเกจ", "จำนวน", "ยอดเงิน (บาท)"];
  const rows = [...map.entries()].sort((a, b) => b[1].qty - a[1].qty).map(([name, v]) => [name, v.qty, v.total]);
  return { header, rows, sheetName: "แพ็กเกจเวลา" };
}

export async function fetchPartiesRows(from: string, to: string) {
  const { start, end } = parseDateRange(from, to);
  const bills = await db.bill.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: {
      table: { select: { number: true } },
      sessions: { select: { nickname: true, packageType: true, packagePrice: true, status: true } },
      orders: { where: { status: "SERVED" }, select: { totalTHB: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const header = ["วันที่", "เวลาเปิด", "ชื่อตี้", "โต๊ะ", "สถานะ", "จำนวนผู้เล่น", "แพ็กเกจ", "รายได้เกม (บาท)", "รายได้อาหาร (บาท)", "รวม (บาท)"];
  const rows = bills.map((b) => {
    const active = b.sessions.filter((s) => s.status !== "LEFT");
    const pkgMap: Record<string, number> = {};
    for (const s of active) pkgMap[s.packageType] = (pkgMap[s.packageType] ?? 0) + 1;
    const pkgSummary = Object.entries(pkgMap).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k}×${n}`).join(", ");
    const gameRev = active.reduce((s, p) => s + p.packagePrice, 0);
    const foodRev = b.orders.reduce((s, o) => s + o.totalTHB, 0);
    return [bkkDate(b.createdAt), bkkDateTime(b.createdAt), b.name, b.table.number, b.status, active.length, pkgSummary, gameRev, foodRev, gameRev + foodRev];
  });
  return { header, rows, sheetName: "ปาร์ตี้" };
}

export async function fetchReceiptsRows(from: string, to: string) {
  const fromDate = new Date(from + "T00:00:00+07:00");
  const toDate = new Date(to + "T23:59:59+07:00");
  const receipts = await db.receipt.findMany({
    where: { confirmedAt: { gte: fromDate, lte: toDate } },
    orderBy: { confirmedAt: "asc" },
  });
  const METHOD: Record<string, string> = { PROMPTPAY: "QR PromptPay", CASH: "เงินสด", TAB: "แท็บ", UNSET: "-" };
  const header = ["เลขที่ใบเสร็จ", "วันที่ชำระ", "ออเดอร์", "สถานที่", "วิธีชำระ", "ยอด (บาท)"];
  const rows = receipts.map((r) => {
    const d = r.confirmedAt.toISOString().slice(0, 10).replace(/-/g, "");
    const no = `RC-${d}-${String(r.id).padStart(5, "0")}`;
    return [no, bkkDateTime(r.confirmedAt), r.orderName ?? "", r.locationLabel ?? "", METHOD[r.paymentMethod] ?? r.paymentMethod, r.totalTHB];
  });
  return { header, rows, sheetName: "ใบเสร็จ" };
}

// ─── Google Sheets upload ────────────────────────────────────────────────────

async function getGoogleToken(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  })).toString("base64url");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${claim}`);
  const jwt = `${header}.${claim}.${sign.sign(sa.private_key, "base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) throw new Error("Failed to get Google access token");
  return data.access_token;
}

export async function uploadToGoogleSheets(
  title: string,
  sheets: { sheetName: string; header: (string | number | null | undefined)[]; rows: (string | number | null | undefined)[][] }[],
  folderId: string
) {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  const sa = JSON.parse(raw) as { client_email: string; private_key: string };
  sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  const token = await getGoogleToken(sa);

  // 1. Create file directly in target folder via Drive API
  const createFileRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: title,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
    }),
  });
  const file = await createFileRes.json() as { id?: string; error?: { message: string } };
  if (!file.id) throw new Error(file.error?.message ?? "Failed to create file in Drive");
  const spreadsheetId = file.id;

  // 2. Rename first sheet and add remaining sheets
  const sheetRequests = [
    { updateSheetProperties: { properties: { sheetId: 0, title: sheets[0].sheetName }, fields: "title" } },
    ...sheets.slice(1).map((s, i) => ({ addSheet: { properties: { sheetId: i + 1, title: s.sheetName } } })),
  ];
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ requests: sheetRequests }),
  });

  // 3. Write data to each sheet
  const data = sheets.map((s) => ({
    range: `${s.sheetName}!A1`,
    values: [s.header, ...s.rows],
  }));
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
  });

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}
