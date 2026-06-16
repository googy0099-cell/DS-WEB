import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  const userId = parseInt(session.user.id);
  const role = session.user.role;

  const order = await db.order.findUnique({
    where: { id: parseInt(orderId) },
    include: {
      items: { include: { menuItem: { select: { nameTh: true } } } },
      payment: true,
      bill: { select: { name: true, table: { select: { number: true } } } },
    },
  });

  if (!order) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });

  // Only allow owner or the customer who placed the order
  const isStaff = role === "OWNER" || role === "CASHIER" || role === "STAFF";
  if (!isStaff && order.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dateStr = new Date(order.createdAt).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const methodLabel: Record<string, string> = {
    PROMPTPAY: "พร้อมเพย์ / QR",
    CASH: "เงินสด",
    SPLIT: "เงินสด + โอน",
    TAB: "เปิดแท็บ",
    UNSET: "-",
  };

  const itemsHtml = order.items.map((item) => {
    const addons: { nameTh: string; quantity?: number }[] = item.selectedAddons ? JSON.parse(item.selectedAddons) : [];
    const options: { groupName: string; choiceName: string }[] = item.selectedOptions ? JSON.parse(item.selectedOptions) : [];
    const extras = [
      item.selectedSize ?? "",
      addons.map((a) => (a.quantity ?? 1) > 1 ? `${a.nameTh} ×${a.quantity}` : a.nameTh).join(", "),
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

  const locationLabel = order.bill
    ? `${order.bill.name} · โต๊ะ ${order.bill.table.number}`
    : order.tableId ? `โต๊ะ ${order.tableId}` : "-";

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ใบเสร็จ #${order.id} — Dice Shop</title>
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
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600}
.badge-green{background:#d1fae5;color:#065f46}
.badge-amber{background:#fef3c7;color:#92400e}
.footer{text-align:center;font-size:12px;color:#999;margin-top:20px}
.print-btn{display:block;width:100%;margin-top:20px;padding:12px;background:#182a47;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer}
@media print{.print-btn,.no-print{display:none}body{padding:8px}}
</style>
</head>
<body>
<h1>🎲 Dice Shop</h1>
<div class="sub">ร้านลูกเต๋า Board Game Café · ใบเสร็จรับเงิน</div>
<hr class="divider"/>
<div class="row"><span class="label">เลขที่ออเดอร์</span><strong>#${order.id}</strong></div>
<div class="row"><span class="label">วันที่</span><span>${dateStr}</span></div>
<div class="row"><span class="label">ชื่อ</span><span>${order.orderName || "-"}</span></div>
<div class="row"><span class="label">ที่</span><span>${locationLabel}</span></div>
<div class="row"><span class="label">วิธีชำระ</span><span>${methodLabel[order.payment?.method ?? "UNSET"] ?? order.payment?.method ?? "-"}</span></div>
<div class="row"><span class="label">สถานะ</span><span class="badge ${order.status === "SERVED" ? "badge-green" : "badge-amber"}">${order.status === "SERVED" ? "ชำระแล้ว" : order.status}</span></div>
<hr class="divider"/>
<table>
  <thead><tr><th style="text-align:left">รายการ</th><th>จำนวน</th><th style="text-align:right">ราคา</th></tr></thead>
  <tbody>${itemsHtml}</tbody>
  <tfoot>
    ${(order.discountAmount ?? 0) > 0 ? `
    <tr><td colspan="2" style="padding-top:6px">ยอดรวม</td><td style="text-align:right;padding-top:6px">฿${order.totalTHB.toLocaleString()}</td></tr>
    <tr><td colspan="2">ส่วนลด</td><td style="text-align:right">−฿${(order.discountAmount ?? 0).toLocaleString()}</td></tr>
    <tr class="total-row"><td colspan="2">รวมทั้งหมด</td><td style="text-align:right">฿${(order.totalTHB - (order.discountAmount ?? 0)).toLocaleString()}</td></tr>
    ` : `
    <tr class="total-row"><td colspan="2">รวมทั้งหมด</td><td style="text-align:right">฿${order.totalTHB.toLocaleString()}</td></tr>
    `}
  </tfoot>
</table>
<hr class="divider"/>
<div class="footer">ขอบคุณที่ใช้บริการ 🎲<br/>Dice Shop — The Board Game Café</div>
<button class="print-btn" onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
