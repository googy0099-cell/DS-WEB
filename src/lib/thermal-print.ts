// Web Serial API type declarations (not in standard TS dom lib yet)
interface SerialPortInfo { usbVendorId?: number; usbProductId?: number; }
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  getInfo(): SerialPortInfo;
}
interface SerialApi {
  requestPort(options?: { filters?: unknown[] }): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}
type NavigatorWithSerial = Navigator & { serial?: SerialApi };

// ESC/POS byte helpers
const enc = new TextEncoder();
const b = (...nums: number[]) => nums;
const t = (s: string) => [...enc.encode(s)];
const ln = (s = "") => t(s + "\n");
const INIT       = b(0x1b, 0x40);
const CENTER     = b(0x1b, 0x61, 0x01);
const LEFT       = b(0x1b, 0x61, 0x00);
const RIGHT      = b(0x1b, 0x61, 0x02);
const BOLD_ON    = b(0x1b, 0x45, 0x01);
const BOLD_OFF   = b(0x1b, 0x45, 0x00);
const DOUBLE     = b(0x1d, 0x21, 0x11);
const NORMAL     = b(0x1d, 0x21, 0x00);
const FEED3      = b(0x1b, 0x64, 0x03);
const CUT        = b(0x1d, 0x56, 0x01);       // partial cut — most widely supported
const SEP        = ln("--------------------------------");

export interface ReceiptEscPosSettings {
  shopName: string;
  shopInfo: string;
  footer: string;
  showOrderId: boolean;
  showDate: boolean;
  showCustomer: boolean;
  showNote: boolean;
  showItemPrice: boolean;
  showTotal: boolean;
  // Optional deep settings — defaults applied inside buildReceiptEscPos
  titleSize?: "double" | "normal";   // shop name font size (double = 2× width+height)
  feedLines?: number;                 // lines to feed before cut (0–10, default 3)
  headerAlign?: "center" | "left";   // alignment for shop name / footer block
}

export interface KitchenEscPosSettings {
  showTable: boolean;
  showNote: boolean;
}

export interface EscPosOrder {
  id: number;
  orderName: string;
  totalTHB: number;          // NET total actually paid (after discount)
  discountAmount?: number;   // if > 0, print subtotal + discount + net
  note?: string | null;
  createdAt: string | Date;
  tableId?: number | null;
  items: {
    nameTh: string;
    selectedSize?: string | null;
    selectedAddons?: string | null;
    selectedOptions?: string | null;
    quantity: number;
    unitPriceTHB: number;
  }[];
}

function parseAddons(raw?: string | null): string {
  if (!raw) return "";
  try { return (JSON.parse(raw) as { nameTh: string }[]).map((a) => a.nameTh).join(", "); }
  catch { return ""; }
}

function parseOptions(raw?: string | null): string {
  if (!raw) return "";
  try { return (JSON.parse(raw) as { choiceName: string }[]).map((o) => o.choiceName).join(", "); }
  catch { return ""; }
}

export function buildReceiptEscPos(order: EscPosOrder, s: ReceiptEscPosSettings): Uint8Array {
  const chunks: number[][] = [];
  const push = (...parts: number[][]) => chunks.push(...parts);

  const titleFont = s.titleSize === "normal" ? NORMAL : DOUBLE;
  const feed = b(0x1b, 0x64, Math.max(0, Math.min(10, s.feedLines ?? 3)));
  const hAlign = s.headerAlign === "left" ? LEFT : CENTER;

  push(INIT, hAlign, titleFont, BOLD_ON, ln(s.shopName), NORMAL, BOLD_OFF);
  push(ln(s.shopInfo), ln("ใบเสร็จรับเงิน"), SEP, LEFT);

  if (s.showCustomer) push(ln(`ออเดอร์: ${order.orderName}`));
  if (s.showOrderId)  push(ln(`เลขที่: #${order.id}`));
  if (s.showDate) {
    const d = new Date(order.createdAt);
    push(ln(`วันที่: ${d.toLocaleDateString("th-TH")} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`));
  }
  push(SEP);

  for (const item of order.items) {
    const extras = [
      item.selectedSize ?? "",
      parseAddons(item.selectedAddons),
      parseOptions(item.selectedOptions),
    ].filter(Boolean).join(" · ");
    push(ln(`${item.nameTh} x${item.quantity}${extras ? ` (${extras})` : ""}`));
    if (s.showItemPrice) push(RIGHT, ln(`฿${item.unitPriceTHB * item.quantity}`), LEFT);
  }

  if (s.showTotal) {
    push(SEP, RIGHT);
    if (order.discountAmount && order.discountAmount > 0) {
      push(ln(`ยอดรวม ฿${order.totalTHB + order.discountAmount}`), ln(`ส่วนลด -฿${order.discountAmount}`));
    }
    push(BOLD_ON, ln(`รวม ฿${order.totalTHB}`), BOLD_OFF, LEFT);
  }
  if (s.showNote && order.note) push(SEP, ln(`หมายเหตุ: ${order.note}`));
  push(SEP, hAlign, ln(s.footer), feed, CUT);

  const flat: number[] = [];
  for (const c of chunks) flat.push(...c);
  return new Uint8Array(flat);
}

export function buildKitchenEscPos(order: EscPosOrder, s: KitchenEscPosSettings): Uint8Array {
  const chunks: number[][] = [];
  const push = (...parts: number[][]) => chunks.push(...parts);

  push(INIT, CENTER, BOLD_ON, DOUBLE, ln("ใบแจ้งครัว"), NORMAL, BOLD_OFF);
  const info = [
    s.showTable && order.tableId ? `โต๊ะ ${order.tableId}` : "",
    `#${order.id}`,
    order.orderName,
  ].filter(Boolean).join(" — ");
  push(ln(info), SEP, LEFT);

  for (const item of order.items) {
    const extras = [
      item.selectedSize ?? "",
      parseAddons(item.selectedAddons),
      parseOptions(item.selectedOptions),
    ].filter(Boolean).join(" · ");
    push(BOLD_ON, ln(`• ${item.nameTh} x${item.quantity}`), BOLD_OFF);
    if (extras) push(ln(`  (${extras})`));
  }

  if (s.showNote && order.note) push(SEP, ln(`หมายเหตุ: ${order.note}`));
  push(FEED3, CUT);

  const flat: number[] = [];
  for (const c of chunks) flat.push(...c);
  return new Uint8Array(flat);
}

// ─── RawBT (Android) image printing ─────────────────────────────────────────
// Web Serial doesn't exist on Android. The shop's Android tablet talks to the
// Bluetooth printer through the RawBT print service, which accepts a print job
// straight from a URL scheme — no Android print dialog. We render the EXACT
// receipt HTML (buildReceiptHtml / buildKitchenHtml) to a PNG with html2canvas
// and hand RawBT the image, so the printout looks identical to the configured
// HTML receipt and Thai always prints correctly regardless of printer fonts.

export type PrintMethod = "auto" | "serial" | "rawbt" | "browser";

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export function getPrintMethod(): PrintMethod {
  try { return (localStorage.getItem("print_method") as PrintMethod) || "auto"; }
  catch { return "auto"; }
}

export function setPrintMethod(m: PrintMethod): void {
  try { localStorage.setItem("print_method", m); } catch {}
}

// Should we route this job through RawBT instead of serial / a print window?
export function rawbtEnabled(): boolean {
  const m = getPrintMethod();
  if (m === "rawbt") return true;
  if (m === "serial" || m === "browser") return false;
  return isAndroid(); // auto: tablets/phones use RawBT, desktops use serial/window
}

// Render a full receipt/kitchen HTML document to a PNG data URL, pixel-identical
// to what the print window shows. Rendered in an isolated off-screen iframe so
// the receipt's global CSS (body{...}, h1{...}) can't leak into the app page.
export async function htmlToPng(html: string, scale = 2): Promise<string> {
  const html2canvas = (await import("html2canvas")).default;
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-99999px;top:0;border:0;width:480px;height:200px;background:#fff";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentWindow!.document;
    doc.open();
    doc.write(html);
    doc.close();

    await new Promise<void>((res) => {
      if (doc.readyState === "complete") res();
      else iframe.contentWindow!.addEventListener("load", () => res(), { once: true });
    });
    // wait for the logo / any images to decode
    await Promise.all(Array.from(doc.images).map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = img.onerror = () => r(); })
    ));
    // wait for web fonts if the document declares any
    try { await (doc as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* ignore */ }

    const body = doc.body;
    const w = Math.ceil(body.scrollWidth);
    const h = Math.ceil(body.scrollHeight);
    iframe.style.width = w + "px";
    iframe.style.height = h + "px";

    const canvas = await html2canvas(body, {
      scale,
      backgroundColor: "#ffffff",
      useCORS: true,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
    });
    return canvas.toDataURL("image/png");
  } finally {
    iframe.remove();
  }
}

// Hand a custom-scheme URL to the OS (opens RawBT) without navigating this page.
function triggerScheme(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1500);
}

// Print a rendered PNG straight to the Bluetooth printer via RawBT — no dialog.
export function printImageViaRawbt(pngDataUrl: string): void {
  triggerScheme("rawbt:" + pngDataUrl); // pngDataUrl is "data:image/png;base64,…"
}

// Print raw ESC/POS bytes via RawBT (falls back to Play Store if not installed).
export function printEscPosViaRawbt(data: Uint8Array): void {
  let bin = "";
  for (let i = 0; i < data.length; i++) bin += String.fromCharCode(data[i]);
  triggerScheme(`intent:base64,${btoa(bin)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`);
}

// --- Serial port helpers ---

function getSerial(): SerialApi | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as NavigatorWithSerial).serial ?? null;
}

export function isSerialSupported(): boolean {
  return !!getSerial();
}

export async function getGrantedPrinter(): Promise<SerialPort | null> {
  const serial = getSerial();
  if (!serial) return null;
  try {
    const ports = await serial.getPorts();
    return ports[0] ?? null;
  } catch { return null; }
}

export async function requestPrinter(): Promise<SerialPort | null> {
  const serial = getSerial();
  if (!serial) return null;
  try {
    return await serial.requestPort({ filters: [] });
  } catch { return null; }
}

export function getBaudRate(): number {
  try { return parseInt(localStorage.getItem("printer_baud_rate") ?? "9600") || 9600; }
  catch { return 9600; }
}

export function setBaudRate(rate: number): void {
  try { localStorage.setItem("printer_baud_rate", String(rate)); } catch {}
}

export async function printToSerial(data: Uint8Array): Promise<boolean> {
  const port = await getGrantedPrinter();
  if (!port) return false;
  const baudRate = getBaudRate();
  try {
    await port.open({ baudRate });
    const writer = port.writable!.getWriter();
    await writer.write(data);
    await writer.close(); // flush before closing port
    await port.close();
    return true;
  } catch (e) {
    console.error("Serial print error:", e);
    try { await port.close(); } catch { /* ignore */ }
    return false;
  }
}
