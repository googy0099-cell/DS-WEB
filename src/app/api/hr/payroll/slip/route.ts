import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { getMonthlySummary } from "@/lib/hr-payroll";

const BKK = 7 * 3600_000;
const MONTH_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function thb(n: number) { return n.toLocaleString("th-TH"); }

function bkkRangeForMonth(year: number, month: number) {
  const startBkk = Date.UTC(year, month - 1, 1, 0, 0, 0);
  const endBkk = Date.UTC(year, month, 1, 0, 0, 0);
  const offset = BKK;
  return { start: new Date(startBkk - offset), end: new Date(endBkk - offset) };
}

function fmtBkkDate(d: Date) {
  const bkk = new Date(d.getTime() + BKK);
  const dd = String(bkk.getUTCDate()).padStart(2, "0");
  const mm = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${bkk.getUTCFullYear() + 543}`;
}

function fmtBkkTime(d: Date) {
  const bkk = new Date(d.getTime() + BKK);
  return `${String(bkk.getUTCHours()).padStart(2, "0")}:${String(bkk.getUTCMinutes()).padStart(2, "0")}`;
}

function statusLabel(s: string | null) {
  if (s === "ON_TIME") return '<span style="color:#2e7d32">✓ ตรงเวลา</span>';
  if (s === "LATE") return '<span style="color:#c62828">⚠ สาย</span>';
  if (s === "EARLY") return '<span style="color:#e65100">↩ ออกเร็ว</span>';
  return "—";
}

function calcGross(payType: string, rate: number, summary: { daysWorked: number; workMinutes: number }) {
  if (payType === "DAILY") return rate * summary.daysWorked;
  if (payType === "HOURLY") return Math.round(rate * summary.workMinutes / 60);
  return rate;
}

function payTypeLabel(p: string) {
  return p === "DAILY" ? "รายวัน" : p === "HOURLY" ? "รายชั่วโมง" : "รายเดือน";
}

function payRateLabel(p: string) {
  return p === "DAILY" ? "/วัน" : p === "HOURLY" ? "/ชม." : "/เดือน";
}

function hoursLabel(min: number) {
  return `${Math.floor(min / 60)} ชม. ${min % 60} น.`;
}

async function buildSlipHtml(
  staffId: number,
  year: number,
  month: number
): Promise<string> {
  const staff = await db.hrStaff.findUnique({
    where: { id: staffId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!staff) return "";

  const name = `${staff.user.firstName} ${staff.user.lastName}`.trim();
  const { start, end } = bkkRangeForMonth(year, month);

  const [attendances, deductions, summary] = await Promise.all([
    db.hrAttendance.findMany({
      where: { staffId, checkIn: { gte: start, lt: end } },
      orderBy: { checkIn: "asc" },
    }),
    db.hrDeduction.findMany({
      where: { staffId, year, month },
      orderBy: { createdAt: "asc" },
    }),
    getMonthlySummary(staffId, year, month),
  ]);

  const gross = calcGross(staff.payType, staff.baseSalary, summary);
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  const netPay = gross - totalDeductions;

  const attRows = attendances.map((a) => `
    <tr>
      <td>${fmtBkkDate(a.checkIn)}</td>
      <td>${fmtBkkTime(a.checkIn)}</td>
      <td>${a.checkOut ? fmtBkkTime(a.checkOut) : "—"}</td>
      <td>${statusLabel(a.checkInStatus)}</td>
      <td>${a.checkOut ? statusLabel(a.checkOutStatus) : "—"}</td>
    </tr>`).join("");

  const dedRows = deductions.map((d) => `
    <tr>
      <td>${fmtBkkDate(d.createdAt)}</td>
      <td>${d.reason}</td>
      <td>${d.note ?? "—"}</td>
      <td style="text-align:right;color:#c62828">−฿${thb(d.amount)}</td>
    </tr>`).join("");

  return `
  <div class="slip" style="page-break-after:always">
    <div class="header">
      <p class="shop">🎲 Dice Shop & Board Game Café</p>
      <p class="title">ใบแจ้งเงินเดือน</p>
      <p class="sub">${MONTH_TH[month - 1]} ${year + 543}</p>
    </div>

    <table class="info-table">
      <tr><td>พนักงาน</td><td><strong>${name}</strong></td></tr>
      <tr><td>ประเภทค่าจ้าง</td><td>${payTypeLabel(staff.payType)}</td></tr>
      <tr><td>อัตรา</td><td>฿${thb(staff.baseSalary)}${payRateLabel(staff.payType)}</td></tr>
      <tr><td>วันทำงาน</td><td>${summary.daysWorked} วัน</td></tr>
      <tr><td>เวลาทำงานรวม</td><td>${hoursLabel(summary.workMinutes)}</td></tr>
      <tr><td>มาตรงเวลา</td><td>${summary.onTimeCount} ครั้ง</td></tr>
      <tr><td>มาสาย</td><td>${summary.lateCount} ครั้ง</td></tr>
    </table>

    <div class="section-title">รายละเอียดการเข้างาน</div>
    ${attendances.length > 0 ? `
    <table class="data-table">
      <thead><tr><th>วันที่</th><th>เช็คอิน</th><th>เช็คเอาต์</th><th>สถานะเข้า</th><th>สถานะออก</th></tr></thead>
      <tbody>${attRows}</tbody>
    </table>` : '<p class="empty">ไม่มีข้อมูลการเข้างาน</p>'}

    <div class="section-title">รายการหัก</div>
    ${deductions.length > 0 ? `
    <table class="data-table">
      <thead><tr><th>วันที่</th><th>เหตุผล</th><th>หมายเหตุ</th><th>จำนวน</th></tr></thead>
      <tbody>${dedRows}</tbody>
    </table>` : '<p class="empty">ไม่มีรายการหัก</p>'}

    <div class="summary">
      <div class="summary-row"><span>รายได้รวม</span><span>฿${thb(gross)}</span></div>
      <div class="summary-row deduct"><span>หักรวม</span><span>−฿${thb(totalDeductions)}</span></div>
      <div class="summary-row net"><span>ยอดสุทธิ</span><span>฿${thb(netPay)}</span></div>
    </div>

    <p class="footer">พิมพ์เมื่อ ${fmtBkkDate(new Date())} · Dice Shop HR System</p>
  </div>`;
}

const HTML_SHELL = (body: string, title: string) => `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #111; background: #f5f5f5; padding: 16px; }
  .slip { background: #fff; border-radius: 12px; padding: 24px; max-width: 680px; margin: 0 auto 24px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #182a47; padding-bottom: 14px; }
  .shop { font-size: 15px; font-weight: 900; color: #182a47; margin-bottom: 4px; }
  .title { font-size: 17px; font-weight: 700; color: #fb8500; }
  .sub { font-size: 12px; color: #555; margin-top: 2px; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .info-table td { padding: 4px 6px; font-size: 13px; }
  .info-table td:first-child { color: #555; width: 45%; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #182a47; background: #f0dcbe; padding: 5px 8px; border-radius: 6px; margin: 14px 0 8px; letter-spacing: .5px; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 4px; }
  .data-table th { background: #182a47; color: #fff; padding: 6px 8px; text-align: left; }
  .data-table td { padding: 5px 8px; border-bottom: 1px solid #f0dcbe; }
  .data-table tr:last-child td { border-bottom: none; }
  .empty { font-size: 12px; color: #999; padding: 6px 0; }
  .summary { border-top: 2px solid #182a47; margin-top: 16px; padding-top: 12px; }
  .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
  .summary-row.deduct { color: #c62828; }
  .summary-row.net { font-size: 16px; font-weight: 900; color: #182a47; padding-top: 8px; border-top: 1px dashed #ccc; margin-top: 4px; }
  .footer { font-size: 10px; color: #aaa; text-align: center; margin-top: 16px; }
  @media print {
    body { background: #fff; padding: 0; }
    .slip { box-shadow: none; border-radius: 0; margin: 0; max-width: 100%; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="no-print" style="max-width:680px;margin:0 auto 16px;display:flex;gap:8px">
  <button onclick="window.print()" style="flex:1;padding:10px;background:#182a47;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">🖨️ พิมพ์ / บันทึก PDF</button>
  <button onclick="window.close()" style="padding:10px 16px;background:#eee;border:none;border-radius:8px;font-size:13px;cursor:pointer">ปิด</button>
</div>
${body}
</body>
</html>`;

export async function GET(req: NextRequest) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "OWNER")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const bkk = new Date(Date.now() + BKK);
  const year = Number(url.searchParams.get("year") ?? bkk.getUTCFullYear());
  const month = Number(url.searchParams.get("month") ?? bkk.getUTCMonth() + 1);
  const staffId = url.searchParams.get("staffId");

  try {
    let body: string;
    let title: string;

    if (staffId) {
      body = await buildSlipHtml(Number(staffId), year, month);
      title = `สลิปเงินเดือน ${MONTH_TH[month - 1]} ${year + 543}`;
    } else {
      // All staff
      const allStaff = await db.hrStaff.findMany({ orderBy: { createdAt: "asc" } });
      const slips = await Promise.all(allStaff.map((s) => buildSlipHtml(s.id, year, month)));
      body = slips.filter(Boolean).join("\n");
      title = `สลิปเงินเดือนทุกคน ${MONTH_TH[month - 1]} ${year + 543}`;
    }

    const html = HTML_SHELL(body, title);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
