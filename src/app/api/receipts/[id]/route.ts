import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (role !== "OWNER" && role !== "CASHIER" && role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const receipt = await db.receipt.findUnique({ where: { id: parseInt(id) } });
  if (!receipt) return NextResponse.json({ error: "ไม่พบใบเสร็จ" }, { status: 404 });

  const receiptNumber = `RC-${receipt.confirmedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${String(receipt.id).padStart(5, "0")}`;

  const dateStr = receipt.confirmedAt.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const methodLabel: Record<string, string> = {
    PROMPTPAY: "พร้อมเพย์ / QR",
    CASH: "เงินสด",
    TAB: "เปิดแท็บ",
    UNSET: "-",
  };

  type ReceiptItem = {
    menuItem: { nameTh: string };
    quantity: number;
    unitPriceTHB: number;
    selectedSize?: string | null;
    selectedAddons?: string | null;
    selectedOptions?: string | null;
  };

  const items: ReceiptItem[] = JSON.parse(receipt.itemsJson);

  const itemsHtml = items.map((item) => {
    const addons: { nameTh: string }[] = item.selectedAddons ? JSON.parse(item.selectedAddons) : [];
    const options: { choiceName: string }[] = item.selectedOptions ? JSON.parse(item.selectedOptions) : [];
    const extras = [
      item.selectedSize ?? "",
      addons.map((a) => a.nameTh).join(", "),
      options.map((o) => o.choiceName).join(", "),
    ].filter(Boolean).join(" · ");
    return `<tr>
      <td style="padding:6px 4px;vertical-align:top">
        ${item.menuItem.nameTh}${extras ? `<br/><small style="color:#888">${extras}</small>` : ""}
      </td>
      <td style="padding:6px 4px;text-align:center">${item.quantity}</td>
      <td style="padding:6px 4px;text-align:right">฿${(item.unitPriceTHB * item.quantity).toLocaleString()}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${receiptNumber} — Dice Shop</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Sarabun','Helvetica Neue',Arial,sans-serif;font-size:14px;color:#111;background:#fff;padding:24px;max-width:480px;margin:0 auto}
h1{font-size:22px;font-weight:900;text-align:center;margin-bottom:2px}
.sub{font-size:12px;color:#666;text-align:center;margin-bottom:16px}
.divider{border:none;border-top:1px dashed #ccc;margin:12px 0}
.row{display:flex;justify-content:space-between;font-size:13px;margin:4px 0}
.label{color:#666}
table{width:100%;border-collapse:collapse;margin:8px 0}
th{font-size:12px;color:#666;padding:4px;border-bottom:1px solid #eee}
.total-row td{font-weight:bold;font-size:16px;padding-top:8px;border-top:1px solid #ccc}
.receipt-no{text-align:center;font-size:11px;color:#999;margin-bottom:8px;letter-spacing:0.05em}
.footer{text-align:center;font-size:12px;color:#999;margin-top:20px}
.print-btn{display:block;width:100%;margin-top:20px;padding:12px;background:#182a47;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer}
@media print{.print-btn{display:none}body{padding:8px}}
</style>
</head>
<body>
<h1>🎲 Dice Shop</h1>
<div class="sub">ร้านลูกเต๋า Board Game Café · ใบเสร็จรับเงิน</div>
<div class="receipt-no">${receiptNumber}</div>
<hr class="divider"/>
<div class="row"><span class="label">เลขที่ออเดอร์</span><strong>#${receipt.orderId}</strong></div>
<div class="row"><span class="label">วันที่ชำระ</span><span>${dateStr}</span></div>
<div class="row"><span class="label">ชื่อ</span><span>${receipt.orderName || "-"}</span></div>
<div class="row"><span class="label">ที่</span><span>${receipt.locationLabel || "-"}</span></div>
<div class="row"><span class="label">วิธีชำระ</span><span>${methodLabel[receipt.paymentMethod] ?? receipt.paymentMethod}</span></div>
<hr class="divider"/>
<table>
  <thead><tr><th style="text-align:left">รายการ</th><th>จำนวน</th><th style="text-align:right">ราคา</th></tr></thead>
  <tbody>${itemsHtml}</tbody>
  <tfoot>
    <tr class="total-row">
      <td colspan="2">รวมทั้งหมด</td>
      <td style="text-align:right">฿${receipt.totalTHB.toLocaleString()}</td>
    </tr>
  </tfoot>
</table>
<hr class="divider"/>
<div class="footer">ขอบคุณที่ใช้บริการ 🎲<br/>Dice Shop — The Board Game Café</div>
<button class="print-btn" onclick="window.print()">🖨️ พิมพ์ / ดาวน์โหลด PDF</button>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
