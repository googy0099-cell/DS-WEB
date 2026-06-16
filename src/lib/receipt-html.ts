export interface ReceiptHtmlSettings {
  shopName: string;
  shopInfo: string;
  paperWidth: string;
  footer: string;
  logoUrl?: string;
  showOrderId: boolean;
  showDate: boolean;
  showCustomer: boolean;
  showNote: boolean;
  showItemPrice: boolean;
  showTotal: boolean;
  titleSize?: "double" | "normal";
  feedLines?: number;
  headerAlign?: "center" | "left";
  htmlFontSize?: number;
  logoSize?: number;
}

export interface ReceiptHtmlItem {
  nameTh: string;
  quantity: number;
  unitPriceTHB: number;
  selectedSize?: string | null;
  selectedAddons?: string | null;
  selectedOptions?: string | null;
}

export interface ReceiptHtmlData {
  orderId: number;
  orderName: string | null;
  totalTHB: number;          // NET total actually paid (after discount)
  discountAmount?: number;   // if > 0, show subtotal + discount + net lines
  note?: string | null;
  dateStr: string;
  items: ReceiptHtmlItem[];
  receiptNumber?: string;
  locationLabel?: string;
  paymentMethod?: string;
  showPrintButton?: boolean;
}

const METHOD_LABEL: Record<string, string> = {
  PROMPTPAY: "พร้อมเพย์ / QR",
  CASH: "เงินสด",
  UNSET: "-",
};

export function buildReceiptHtml(data: ReceiptHtmlData, settings: ReceiptHtmlSettings): string {
  const w = settings.paperWidth === "A4" ? "210mm" : `${settings.paperWidth}mm`;
  const fs = settings.htmlFontSize ?? 13;
  const hAlign = settings.headerAlign ?? "center";
  const logoSz = settings.logoSize ?? 80;
  // Blank feed before the cut line. Each line is a real white-filled box (not an
  // empty gap) so it renders as actual white pixels in the html2canvas PNG and the
  // thermal printer advances the paper through it — pushing content past the
  // print-head→tear-bar dead zone. Verified with scripts/verify-feed.mjs.
  const feedLines = Math.max(0, Math.min(10, settings.feedLines ?? 3));
  const feedLineH = fs + 2;
  const feedHtml = Array.from({ length: feedLines },
    () => `<div style="height:${feedLineH}px;background:#fff"></div>`).join("");

  const itemsHtml = data.items.map((item) => {
    const addons: { nameTh: string }[] = item.selectedAddons ? JSON.parse(item.selectedAddons) : [];
    const options: { groupName: string; choiceName: string }[] = item.selectedOptions ? JSON.parse(item.selectedOptions) : [];
    const subtotal = item.unitPriceTHB * item.quantity;
    const extras = [
      addons.length > 0 ? `+ ${addons.map((a) => a.nameTh).join(", ")}` : "",
      options.length > 0 ? options.map((o) => `${o.groupName}: ${o.choiceName}`).join(", ") : "",
    ].filter(Boolean).join(" | ");
    return `<tr>
      <td style="padding:4px 2px;vertical-align:top">
        ${item.nameTh}${item.selectedSize ? ` (${item.selectedSize})` : ""} ×${item.quantity}
        ${extras ? `<br/><small style="color:#888">${extras}</small>` : ""}
      </td>
      ${settings.showItemPrice ? `<td style="padding:4px 2px;text-align:right;vertical-align:top;white-space:nowrap">฿${subtotal}</td>` : ""}
    </tr>`;
  }).join("");

  const extraRows = [
    data.locationLabel ? `<div><b>ที่:</b> ${data.locationLabel}</div>` : "",
    data.paymentMethod ? `<div><b>วิธีชำระ:</b> ${METHOD_LABEL[data.paymentMethod] ?? data.paymentMethod}</div>` : "",
  ].filter(Boolean).join("");

  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>ใบเสร็จ #${data.orderId}</title>
<style>@page{margin:0;size:${w} auto}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Sarabun','Helvetica Neue',Arial,sans-serif;font-size:${fs}px;color:#111;width:${w};margin:0 auto;padding:3mm 4mm 0}.logo{display:block;max-width:${logoSz}px;max-height:${logoSz}px;margin:0 auto 4px;object-fit:contain}h1{font-size:${Math.round(fs * 1.4)}px;font-weight:900;text-align:${hAlign};margin-bottom:2px}.sub{font-size:${Math.round(fs * 0.85)}px;text-align:${hAlign};color:#555;margin-bottom:4px}.divider{border:none;border-top:1px dashed #aaa;margin:4px 0}.receipt-no{text-align:center;font-size:11px;color:#999;margin-bottom:4px;letter-spacing:0.05em}table{width:100%;border-collapse:collapse}.total-row td{font-weight:bold;font-size:${Math.round(fs * 1.15)}px;padding-top:4px;border-top:1px dashed #aaa}.note{font-size:${Math.round(fs * 0.92)}px;margin-top:4px}.footer{text-align:center;font-size:${Math.round(fs * 0.85)}px;color:#777;margin-top:6px}.cut-line{margin-top:2px;border:none;border-top:1px dashed #999;position:relative;text-align:center}.cut-line::after{content:'✂';position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#fff;padding:0 4px;font-size:12px;color:#999}@media print{button{display:none}}</style>
</head><body>
${settings.logoUrl ? `<img src="${settings.logoUrl}" class="logo" alt="logo"/>` : ""}
<h1>${settings.logoUrl ? "" : "🎲 "}${settings.shopName}</h1>
<div class="sub">${settings.shopInfo} • ใบเสร็จรับเงิน</div>
${data.receiptNumber ? `<div class="receipt-no">${data.receiptNumber}</div>` : ""}
<hr class="divider"/>
<div style="font-size:12px;margin-bottom:4px">
${settings.showCustomer ? `<div><b>ออเดอร์:</b> ${data.orderName || `#${data.orderId}`}</div>` : ""}
${settings.showOrderId ? `<div><b>เลขที่:</b> #${data.orderId}</div>` : ""}
${settings.showDate ? `<div><b>วันที่:</b> ${data.dateStr}</div>` : ""}
${extraRows}
</div>
<hr class="divider"/>
<table><tbody>${itemsHtml}</tbody>
${settings.showTotal ? `<tfoot>${
  data.discountAmount && data.discountAmount > 0
    ? `<tr><td style="padding-top:4px;border-top:1px dashed #aaa">ยอดรวม</td><td style="text-align:right;padding-top:4px;border-top:1px dashed #aaa">฿${data.totalTHB + data.discountAmount}</td></tr>`
      + `<tr><td>ส่วนลด</td><td style="text-align:right">−฿${data.discountAmount}</td></tr>`
      + `<tr class="total-row"><td>รวมทั้งหมด</td><td style="text-align:right">฿${data.totalTHB}</td></tr>`
    : `<tr class="total-row"><td>รวมทั้งหมด</td><td style="text-align:right">฿${data.totalTHB}</td></tr>`
}</tfoot>` : ""}
</table>
${settings.showNote && data.note ? `<div class="note">📝 หมายเหตุ: ${data.note}</div>` : ""}
<div class="footer">${settings.footer}</div>
${feedHtml}
<hr class="cut-line"/>
${data.showPrintButton ? `<button style="display:block;width:100%;margin-top:20px;padding:12px;background:#182a47;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer" onclick="window.print()">🖨️ พิมพ์ / ดาวน์โหลด PDF</button>` : ""}
</body></html>`;
}

export interface KitchenHtmlSettings {
  paperWidth: string;
  showTable: boolean;
  showNote: boolean;
}

export interface KitchenHtmlItem {
  nameTh: string;
  quantity: number;
  selectedSize?: string | null;
  selectedAddons?: string | null;
  selectedOptions?: string | null;
}

export interface KitchenHtmlData {
  orderId: number;
  orderName: string | null;
  note?: string | null;
  tableId?: number | null;
  items: KitchenHtmlItem[];
}

export function buildKitchenHtml(data: KitchenHtmlData, settings: KitchenHtmlSettings): string {
  const w = settings.paperWidth === "A4" ? "210mm" : `${settings.paperWidth}mm`;
  const itemsHtml = data.items.map((item) => {
    const addons: { nameTh: string }[] = item.selectedAddons ? JSON.parse(item.selectedAddons) : [];
    const options: { groupName: string; choiceName: string }[] = item.selectedOptions ? JSON.parse(item.selectedOptions) : [];
    const extras = [
      item.selectedSize ? item.selectedSize : "",
      addons.length > 0 ? addons.map((a) => a.nameTh).join(", ") : "",
      options.length > 0 ? options.map((o) => o.choiceName).join(", ") : "",
    ].filter(Boolean).join(" · ");
    return `<div style="padding:4px 0;font-size:15px;font-weight:bold">• ${item.nameTh} ×${item.quantity}${extras ? `<span style="font-weight:normal;font-size:13px"> (${extras})</span>` : ""}</div>`;
  }).join("");

  const tableInfo = settings.showTable && data.tableId ? `โต๊ะ ${data.tableId} — ` : "";
  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><title>ใบครัว #${data.orderId}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Sarabun','Helvetica Neue',Arial,sans-serif;font-size:14px;color:#111;width:${w};margin:0 auto;padding:8px}h1{font-size:17px;font-weight:900;text-align:center;margin-bottom:4px}.info{font-size:12px;text-align:center;margin-bottom:4px}.divider{border:none;border-top:2px solid #111;margin:6px 0}.note{font-size:13px;margin-top:6px;padding:4px 0;border-top:1px dashed #aaa}@media print{body{width:100%}}</style>
</head><body>
<h1>🍳 ใบแจ้งครัว</h1>
<div class="info">${tableInfo}ออเดอร์ #${data.orderId}${data.orderName ? ` — ${data.orderName}` : ""}</div>
<hr class="divider"/>
${itemsHtml}
${settings.showNote && data.note ? `<div class="note">📝 ${data.note}</div>` : ""}
</body></html>`;
}
