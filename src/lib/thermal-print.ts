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
const CUT        = b(0x1d, 0x56, 0x41, 0x03);
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
}

export interface KitchenEscPosSettings {
  showTable: boolean;
  showNote: boolean;
}

export interface EscPosOrder {
  id: number;
  orderName: string;
  totalTHB: number;
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

  push(INIT, CENTER, DOUBLE, BOLD_ON, ln(s.shopName), NORMAL, BOLD_OFF);
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

  if (s.showTotal) push(SEP, BOLD_ON, RIGHT, ln(`รวม ฿${order.totalTHB}`), LEFT, BOLD_OFF);
  if (s.showNote && order.note) push(SEP, ln(`หมายเหตุ: ${order.note}`));
  push(SEP, CENTER, ln(s.footer), FEED3, CUT);

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
    writer.releaseLock();
    await port.close();
    return true;
  } catch (e) {
    console.error("Serial print error:", e);
    try { await port.close(); } catch { /* ignore */ }
    return false;
  }
}
