// Render the REAL buildReceiptHtml output to a PNG via the app's html2canvas,
// save the image, and measure the blank feed below the cut line — actual proof,
// not analysis. Run: node --experimental-strip-types scripts/render-receipt.mts
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";
import { buildReceiptHtml, type ReceiptHtmlSettings } from "../src/lib/receipt-html.ts";

const PX_TO_MM = 25.4 / 96;
const feedLinesArg = Number(process.argv[2] ?? 3);

const settings: ReceiptHtmlSettings = {
  shopName: "ร้านลูกเต๋า Dice Shop",
  shopInfo: "10/30-31 ถนนเจริญประดิษฐ์ ต.รูสะมิแล อ.เมือง จ.ปัตตานี 94000",
  paperWidth: "58", footer: "ขอบคุณที่ใช้บริการ",
  showOrderId: true, showDate: true, showCustomer: true, showNote: true,
  showItemPrice: true, showTotal: true, titleSize: "double",
  feedLines: feedLinesArg, headerAlign: "center", htmlFontSize: 13,
};

const html = buildReceiptHtml({
  orderId: 999, orderName: "ทดสอบ", totalTHB: 150, note: "ไม่ใส่น้ำตาล",
  dateStr: new Date().toLocaleString("th-TH"),
  items: [
    { nameTh: "ชาไทย", selectedSize: "XL", selectedAddons: null, selectedOptions: null, quantity: 2, unitPriceTHB: 55 },
    { nameTh: "กาแฟ", selectedSize: null, selectedAddons: null, selectedOptions: null, quantity: 1, unitPriceTHB: 40 },
  ],
}, settings);

const html2canvasSrc = readFileSync("node_modules/html2canvas/dist/html2canvas.min.js", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.addScriptTag({ content: html2canvasSrc });

const out = await page.evaluate(async () => {
  const body = document.body;
  const w = Math.ceil(body.scrollWidth);
  const h = Math.ceil(body.scrollHeight);
  const canvas = await (window as any).html2canvas(body, {
    scale: 2, backgroundColor: "#ffffff", width: w, height: h, windowWidth: w, windowHeight: h,
  });
  // last dashed line = the cut line (last .cut-line). measure blank below it.
  const cut = document.querySelector(".cut-line") as HTMLElement;
  const cutBottom = cut.getBoundingClientRect().bottom;
  const footer = document.querySelector(".footer") as HTMLElement;
  return {
    scrollH: h, canvasH: canvas.height / 2,
    footerBottom: Math.round(footer.getBoundingClientRect().bottom),
    cutBottom: Math.round(cutBottom),
    blankBelowCut: Math.round(h - cutBottom),
    gapFooterToCut: Math.round(cut.getBoundingClientRect().top - footer.getBoundingClientRect().bottom),
    png: canvas.toDataURL("image/png"),
  };
});

writeFileSync("scripts/receipt-out.png", Buffer.from(out.png.split(",")[1], "base64"));
await browser.close();

console.log(`feedLines = ${feedLinesArg}`);
console.log(`PNG height matches DOM: ${out.canvasH} vs ${out.scrollH}px  ${Math.abs(out.canvasH - out.scrollH) < 4 ? "✅" : "❌"}`);
console.log(`gap footer→cut line : ${out.gapFooterToCut}px (~${(out.gapFooterToCut * PX_TO_MM).toFixed(1)}mm)`);
console.log(`blank BELOW cut line: ${out.blankBelowCut}px (~${(out.blankBelowCut * PX_TO_MM).toFixed(1)}mm)  ← this is what feeds before tear`);
console.log(`saved image: scripts/receipt-out.png`);
