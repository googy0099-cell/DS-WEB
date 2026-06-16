// Real verification: render 3 feed variants with the ACTUAL html2canvas the app
// uses, then measure whether the blank feed survives into the canvas (PNG) or
// gets trimmed. Mirrors htmlToPng() in src/lib/thermal-print.ts.
import { chromium } from "playwright";
import { readFileSync } from "fs";

const html2canvasSrc = readFileSync("node_modules/html2canvas/dist/html2canvas.min.js", "utf8");

const FS = 13;
const FEED_LINES = 5;
const lineH = FS + 2;                      // 15px per "line"
const expectFeedPx = FEED_LINES * lineH;   // 75px of feed we asked for

const variants = {
  "A_empty_div": `<div class="feed" style="height:${expectFeedPx}px"></div>`,
  "B_nbsp_lines": `<div class="feed" style="height:${expectFeedPx}px;line-height:${lineH}px;color:#fff;font-size:1px">${"&nbsp;<br/>".repeat(FEED_LINES)}</div>`,
  "C_white_boxes": Array.from({ length: FEED_LINES },
    () => `<div style="height:${lineH}px;background:#fff"></div>`).join(""),
};

function buildHtml(feed) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial;font-size:${FS}px;color:#111;width:58mm;margin:0 auto;padding:3mm 4mm 0;background:#fff}
.cut-line{margin-top:2px;border:none;border-top:1px dashed #999}
.footer{text-align:center;font-size:11px;color:#777;margin-top:6px}</style></head>
<body>
<div>ออเดอร์: ทดสอบ</div><div>เลขที่: #999</div>
<div>ชาไทย (XL) ×2 — ฿110</div><div>กาแฟ ×1 — ฿40</div>
<div style="font-weight:bold;border-top:1px dashed #aaa;margin-top:4px">รวมทั้งหมด ฿150</div>
<div class="footer">ขอบคุณที่ใช้บริการ</div>
${feed}
<hr class="cut-line"/>
</body></html>`;
}

const browser = await chromium.launch();
console.log(`Asked for feed = ${FEED_LINES} lines × ${lineH}px = ${expectFeedPx}px of blank before the cut line\n`);

for (const [name, feed] of Object.entries(variants)) {
  const page = await browser.newPage();
  await page.setContent(buildHtml(feed), { waitUntil: "load" });
  await page.addScriptTag({ content: html2canvasSrc });

  const result = await page.evaluate(async () => {
    const body = document.body;
    const w = Math.ceil(body.scrollWidth);
    const h = Math.ceil(body.scrollHeight);
    const canvas = await window.html2canvas(body, {
      scale: 1, backgroundColor: "#ffffff", width: w, height: h, windowWidth: w, windowHeight: h,
    });
    const cut = document.querySelector(".cut-line");
    const footer = document.querySelector(".footer");
    const gap = cut.getBoundingClientRect().top - footer.getBoundingClientRect().bottom;
    return { scrollH: h, canvasH: canvas.height, gap: Math.round(gap) };
  });
  await page.close();

  const ok = Math.abs(result.gap - expectFeedPx) < 8 && Math.abs(result.canvasH - result.scrollH) < 4;
  console.log(`${name.padEnd(14)} domScrollH=${result.scrollH}px  canvasH=${result.canvasH}px  feedGap=${result.gap}px  ${ok ? "✅ feed survived" : "❌ feed lost/trimmed"}`);
}

await browser.close();
