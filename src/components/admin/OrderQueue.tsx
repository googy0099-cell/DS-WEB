"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { formatThaiDateTime } from "@/lib/thai-datetime";
import type { OrderWithItems } from "@/types";
import {
  buildReceiptEscPos, buildKitchenEscPos, printToSerial,
  getGrantedPrinter,
} from "@/lib/thermal-print";
import { buildReceiptHtml } from "@/lib/receipt-html";
import type { ReceiptHtmlSettings } from "@/lib/receipt-html";

interface ReceiptSettings {
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

interface KitchenSettings {
  enabled: boolean;
  paperWidth: string;
  showTable: boolean;
  showNote: boolean;
}

const DEFAULT_RECEIPT: ReceiptSettings = {
  shopName: "ร้านลูกเต๋า", shopInfo: "The Dice Shop", paperWidth: "80",
  footer: "ขอบคุณที่ใช้บริการ 🎲",
  showOrderId: true, showDate: true, showCustomer: true,
  showNote: true, showItemPrice: true, showTotal: true,
  titleSize: "double", feedLines: 3, headerAlign: "center", htmlFontSize: 13, logoSize: 80,
};

const DEFAULT_KITCHEN: KitchenSettings = {
  enabled: false, paperWidth: "80", showTable: true, showNote: true,
};

function openPrintWindow(html: string) {
  const win = window.open("", "_blank", "width=420,height=620");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

async function printReceipt(order: OrderWithItems, settings: ReceiptSettings = DEFAULT_RECEIPT) {
  const discountAmount = order.discountAmount ?? 0;
  const netTotal = order.totalTHB - discountAmount;
  // Try silent serial print first
  const hasPrinter = await getGrantedPrinter();
  if (hasPrinter) {
    const data = buildReceiptEscPos(
      {
        id: order.id,
        orderName: order.orderName,
        totalTHB: netTotal,
        discountAmount,
        note: order.note,
        createdAt: order.createdAt,
        tableId: order.tableId,
        items: order.items.map((i) => ({
          nameTh: i.menuItem.nameTh,
          selectedSize: i.selectedSize,
          selectedAddons: i.selectedAddons,
          selectedOptions: i.selectedOptions,
          quantity: i.quantity,
          unitPriceTHB: i.unitPriceTHB,
        })),
      },
      {
        shopName: settings.shopName,
        shopInfo: settings.shopInfo,
        footer: settings.footer,
        showOrderId: settings.showOrderId,
        showDate: settings.showDate,
        showCustomer: settings.showCustomer,
        showNote: settings.showNote,
        showItemPrice: settings.showItemPrice,
        showTotal: settings.showTotal,
        titleSize: settings.titleSize,
        feedLines: settings.feedLines,
        headerAlign: settings.headerAlign,
      }
    );
    const ok = await printToSerial(data);
    if (ok) return;
  }
  // Fallback: browser print window
  openPrintWindow(buildReceiptHtml(
    {
      orderId: order.id,
      orderName: order.orderName,
      totalTHB: netTotal,
      discountAmount,
      note: order.note,
      dateStr: formatThaiDateTime(order.createdAt),
      items: order.items.map((i) => ({ ...i, nameTh: i.menuItem.nameTh })),
    },
    settings as ReceiptHtmlSettings
  ));
}

async function printBillGroupReceipt(orders: OrderWithItems[], settings: ReceiptSettings = DEFAULT_RECEIPT) {
  if (orders.length === 0) return;
  const first = orders[0];
  const bill = first.bill;
  const allItems = orders.flatMap((o) =>
    o.items.map((i) => ({
      nameTh: i.menuItem.nameTh,
      selectedSize: i.selectedSize,
      selectedAddons: i.selectedAddons,
      selectedOptions: i.selectedOptions,
      quantity: i.quantity,
      unitPriceTHB: i.unitPriceTHB,
    }))
  );
  const totalTHB = orders.reduce((s, o) => s + o.totalTHB, 0);
  const orderName = bill ? `ตี้ ${bill.name} · โต๊ะ ${bill.table.number}` : `โต๊ะ ${first.tableId ?? ""}`;

  const hasPrinter = await getGrantedPrinter();
  if (hasPrinter) {
    const data = buildReceiptEscPos(
      { id: first.id, orderName, totalTHB, note: null, createdAt: first.createdAt, tableId: first.tableId, items: allItems },
      { shopName: settings.shopName, shopInfo: settings.shopInfo, footer: settings.footer,
        showOrderId: false, showDate: settings.showDate, showCustomer: true,
        showNote: false, showItemPrice: settings.showItemPrice, showTotal: settings.showTotal,
        titleSize: settings.titleSize, feedLines: settings.feedLines, headerAlign: settings.headerAlign }
    );
    const ok = await printToSerial(data);
    if (ok) return;
  }

  // Fallback: browser print window
  openPrintWindow(buildReceiptHtml(
    {
      orderId: first.id,
      orderName,
      totalTHB,
      dateStr: formatThaiDateTime(first.createdAt),
      items: allItems,
    },
    settings as ReceiptHtmlSettings
  ));
}

async function printKitchen(order: OrderWithItems, settings: KitchenSettings = DEFAULT_KITCHEN) {
  // Try silent serial print first
  const hasPrinter = await getGrantedPrinter();
  if (hasPrinter) {
    const data = buildKitchenEscPos(
      {
        id: order.id,
        orderName: order.orderName,
        totalTHB: order.totalTHB,
        note: order.note,
        createdAt: order.createdAt,
        tableId: order.tableId,
        items: order.items.map((i) => ({
          nameTh: i.menuItem.nameTh,
          selectedSize: i.selectedSize,
          selectedAddons: i.selectedAddons,
          selectedOptions: i.selectedOptions,
          quantity: i.quantity,
          unitPriceTHB: i.unitPriceTHB,
        })),
      },
      { showTable: settings.showTable, showNote: settings.showNote }
    );
    const ok = await printToSerial(data);
    if (ok) return;
  }
  // Fallback: browser print window
  const w = settings.paperWidth === "A4" ? "210mm" : `${settings.paperWidth}mm`;
  const itemsHtml = order.items
    .map((item) => {
      const addons: { nameTh: string }[] = item.selectedAddons ? JSON.parse(item.selectedAddons) : [];
      const options: { groupName: string; choiceName: string }[] = item.selectedOptions ? JSON.parse(item.selectedOptions) : [];
      const extras = [
        item.selectedSize ? item.selectedSize : "",
        addons.length > 0 ? addons.map((a) => a.nameTh).join(", ") : "",
        options.length > 0 ? options.map((o) => o.choiceName).join(", ") : "",
      ].filter(Boolean).join(" · ");
      return `<div style="padding:4px 0;font-size:15px;font-weight:bold">• ${item.menuItem.nameTh} ×${item.quantity}${extras ? `<span style="font-weight:normal;font-size:13px"> (${extras})</span>` : ""}</div>`;
    })
    .join("");

  const tableInfo = settings.showTable && order.tableId ? `โต๊ะ ${order.tableId} — ` : "";
  openPrintWindow(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><title>ใบครัว #${order.id}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Sarabun','Helvetica Neue',Arial,sans-serif;font-size:14px;color:#111;width:${w};margin:0 auto;padding:8px}h1{font-size:17px;font-weight:900;text-align:center;margin-bottom:4px}.info{font-size:12px;text-align:center;margin-bottom:4px}.divider{border:none;border-top:2px solid #111;margin:6px 0}.note{font-size:13px;margin-top:6px;padding:4px 0;border-top:1px dashed #aaa}@media print{body{width:100%}}</style>
</head><body>
<h1>🍳 ใบแจ้งครัว</h1>
<div class="info">${tableInfo}ออเดอร์ #${order.id}${order.orderName ? ` — ${order.orderName}` : ""}</div>
<hr class="divider"/>
${itemsHtml}
${settings.showNote && order.note ? `<div class="note">📝 ${order.note}</div>` : ""}
</body></html>`);
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function playDoneChime() {
  try {
    const ctx = new AudioContext();
    const notes = [880, 1108];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch {}
}

const STATUS_CONFIG = {
  PENDING: {
    label: "🔔 ออเดอร์ใหม่",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
    next: "CONFIRMED",
    nextLabel: "✅ รับออเดอร์แล้ว",
    nextColor: "bg-navy text-cream",
  },
  CONFIRMED: {
    label: "⏳ รอลูกค้าชำระ",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    next: "PAID",
    nextLabel: "💰 ลูกค้าชำระแล้ว",
    nextColor: "bg-green-600 text-white",
  },
  PAID: {
    label: "💰 ชำระแล้ว รอครัว",
    color: "bg-green-100 text-green-800 border-green-300",
    next: null,
    nextLabel: null,
    nextColor: "",
  },
  SERVED: {
    label: "🎉 เสร็จสิ้น",
    color: "bg-gray-100 text-gray-500 border-gray-200",
    next: null,
    nextLabel: null,
    nextColor: "",
  },
  CANCELLED: {
    label: "❌ ยกเลิก",
    color: "bg-red-100 text-red-800 border-red-200",
    next: null,
    nextLabel: null,
    nextColor: "",
  },
};

const BILL_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  indigo:  { bg: "bg-indigo-600",  text: "text-white", border: "border-indigo-700" },
  emerald: { bg: "bg-emerald-600", text: "text-white", border: "border-emerald-700" },
  rose:    { bg: "bg-rose-600",    text: "text-white", border: "border-rose-700" },
  amber:   { bg: "bg-amber-500",   text: "text-white", border: "border-amber-600" },
  violet:  { bg: "bg-violet-600",  text: "text-white", border: "border-violet-700" },
  teal:    { bg: "bg-teal-600",    text: "text-white", border: "border-teal-700" },
  sky:     { bg: "bg-sky-500",     text: "text-white", border: "border-sky-600" },
  pink:    { bg: "bg-pink-500",    text: "text-white", border: "border-pink-600" },
};

function isKitchenDone(items: OrderWithItems["items"]) {
  const kitchenItems = items.filter((i) => !i.cancelledAt && i.menuItem.queueTarget !== "none");
  return kitchenItems.length === 0 || kitchenItems.every((i) => !!i.kitchenServedAt);
}

function resolveStatusBadge(order: OrderWithItems) {
  const method = order.payment?.method;
  const hasSlip = !!order.payment?.slipUrl;
  const kitchenDone = isKitchenDone(order.items);

  if (order.status === "PENDING") {
    if (method === "CASH")
      return { label: "🏪 รอชำระที่เคาน์เตอร์", color: "bg-indigo-100 text-indigo-800 border-indigo-300" };
    if (method === "PROMPTPAY" && hasSlip)
      return { label: "📨 มีสลิปแล้ว รอยืนยัน", color: "bg-teal-100 text-teal-800 border-teal-300" };
    if (method === "PROMPTPAY")
      return { label: "📷 รอสลิปจากลูกค้า", color: "bg-blue-100 text-blue-800 border-blue-300" };
    if (method === "TAB")
      return { label: "🧾 TAB · รอรับออเดอร์", color: "bg-amber-100 text-amber-800 border-amber-300" };
  }
  if (order.status === "CONFIRMED" && (method === "TAB" || method === "UNSET" || !method)) {
    if (kitchenDone)
      return { label: "✅ อาหารพร้อม รอชำระ", color: "bg-green-100 text-green-800 border-green-300" };
    return { label: "🍳 กำลังทำ · รอชำระ", color: "bg-amber-100 text-amber-800 border-amber-300" };
  }
  if (order.status === "PAID") {
    if (kitchenDone)
      return { label: "✅ อาหารพร้อม ชำระแล้ว", color: "bg-green-100 text-green-800 border-green-300" };
    return { label: "💰 ชำระแล้ว กำลังทำ", color: "bg-blue-100 text-blue-800 border-blue-300" };
  }
  return STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING;
}

interface ConfirmState {
  message: string;
  detail?: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
}

interface EditItem {
  id: number;
  nameTh: string;
  selectedSize: string | null;
  unitPrice: number;
  quantity: number;
}

function playBeep(ctx: AudioContext) {
  const now = ctx.currentTime;
  const pattern = [0, 0.15, 0.3, 0.45];
  pattern.forEach((t) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(1050, now + t);
    osc.frequency.setValueAtTime(780, now + t + 0.06);
    gain.gain.setValueAtTime(0.6, now + t);
    gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.12);
    osc.start(now + t);
    osc.stop(now + t + 0.12);
  });
}

async function showBrowserNotification(orderName: string, total: number | string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const body = typeof total === "number" ? `${orderName} • ฿${total}` : total;
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (reg) {
      reg.active?.postMessage({ type: "ORDER_ALERT", body });
      return;
    }
  }
  new Notification("🔔 ออเดอร์ใหม่เข้า!", { body, icon: "/DS-new-logo.png" });
}

export default function OrderQueue() {
  const { data: orders, mutate } = useSWR<OrderWithItems[]>(
    "/api/orders?status=active",
    fetcher,
    { refreshInterval: 2000 }
  );
  const { data: todayOrders, mutate: mutateTodayOrders } = useSWR<OrderWithItems[]>(
    "/api/orders?status=today",
    fetcher,
    { refreshInterval: 10000 }
  );
  const { data: activeBills } = useSWR<{ id: number; name: string; color: string; table: { number: number } }[]>(
    "/api/pos/bills",
    fetcher,
    { refreshInterval: 30000 }
  );

  const prevIdsRef = useRef<Set<number>>(new Set());
  const prevKitchenDoneRef = useRef<Set<number>>(new Set());
  const firstRenderRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alertBufRef = useRef<ArrayBuffer | null>(null);
  const kitchenBufRef = useRef<ArrayBuffer | null>(null);
  const alertLoopRef = useRef<AudioBufferSourceNode | null>(null);
  const kitchenLoopRef = useRef<AudioBufferSourceNode | null>(null);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [servedAcked, setServedAcked] = useState<Set<number>>(() => {
    try {
      if (typeof window === "undefined") return new Set<number>();
      return new Set(JSON.parse(localStorage.getItem("servedAcked") ?? "[]") as number[]);
    } catch { return new Set<number>(); }
  });
  const [kitchenItemAcked, setKitchenItemAcked] = useState<Set<number>>(() => {
    try {
      if (typeof window === "undefined") return new Set<number>();
      return new Set(JSON.parse(localStorage.getItem("kitchenItemAcked") ?? "[]") as number[]);
    } catch { return new Set<number>(); }
  });
  const [alertOrderAcked, setAlertOrderAcked] = useState<Set<number>>(() => {
    try {
      if (typeof window === "undefined") return new Set<number>();
      return new Set(JSON.parse(localStorage.getItem("alertOrderAcked") ?? "[]") as number[]);
    } catch { return new Set<number>(); }
  });

  function markServedAck(orderId: number) {
    setServedAcked((prev) => {
      const next = new Set(prev);
      next.add(orderId);
      try { localStorage.setItem("servedAcked", JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function ackKitchenItems(itemIds: number[]) {
    if (itemIds.length === 0) return;
    setKitchenItemAcked((prev) => {
      const next = new Set(prev);
      itemIds.forEach((id) => next.add(id));
      try {
        localStorage.setItem("kitchenItemAcked", JSON.stringify([...next]));
        window.dispatchEvent(new Event("alertAckSync"));
      } catch {}
      return next;
    });
  }

  function ackAlertOrders(orderIds: number[]) {
    if (orderIds.length === 0) return;
    setAlertOrderAcked((prev) => {
      const next = new Set(prev);
      orderIds.forEach((id) => next.add(id));
      try {
        localStorage.setItem("alertOrderAcked", JSON.stringify([...next]));
        window.dispatchEvent(new Event("alertAckSync"));
      } catch {}
      return next;
    });
  }

  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [confirmAction, setConfirmAction] = useState<ConfirmState | null>(null);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(DEFAULT_RECEIPT);
  const [kitchenSettings, setKitchenSettings] = useState<KitchenSettings>(DEFAULT_KITCHEN);
  const [alertSoundUrl, setAlertSoundUrl] = useState<string>("");
  const [kitchenSoundUrl, setKitchenSoundUrl] = useState<string>("");

  // Cash payment modal (single order)
  const [cashOrder, setCashOrder] = useState<OrderWithItems | null>(null);
  const [cashInputStr, setCashInputStr] = useState("");

  // Bill group cash modal (multiple TAB orders from same bill)
  const [billGroupCash, setBillGroupCash] = useState<{
    billId: number; billName: string; orders: OrderWithItems[]; total: number;
  } | null>(null);
  const [billCashInputStr, setBillCashInputStr] = useState("");
  const [billGroupCashLoading, setBillGroupCashLoading] = useState(false);
  const [billGroupScan, setBillGroupScan] = useState<{
    billId: number; billName: string; orders: OrderWithItems[]; total: number;
  } | null>(null);
  const [billScanLoading, setBillScanLoading] = useState(false);
  // Split payment modal (cash portion first, then scan for remainder)
  const [billGroupSplit, setBillGroupSplit] = useState<{
    billId: number; billName: string; orders: OrderWithItems[]; total: number;
    step: "cash-portion" | "cash-received" | "scan"; cashPaid: number;
  } | null>(null);
  const [splitCashStr, setSplitCashStr] = useState("");
  const [splitReceivedStr, setSplitReceivedStr] = useState("");
  const [splitLoading, setSplitLoading] = useState(false);
  // Single-order split payment (no bill group)
  const [orderSplit, setOrderSplit] = useState<{
    order: OrderWithItems; step: "cash-portion" | "cash-received" | "scan"; cashPaid: number;
  } | null>(null);
  const [orderSplitCashStr, setOrderSplitCashStr] = useState("");
  const [orderSplitReceivedStr, setOrderSplitReceivedStr] = useState("");
  // Discount state shared by cash + scan bill-group modals
  const [discount, setDiscount] = useState<{ type: "PERCENT" | "FIXED"; value: string; note: string }>
    ({ type: "PERCENT", value: "", note: "" });
  // Transient discount per single order (not stored in DB)
  const [orderDiscounts, setOrderDiscounts] = useState<
    Record<number, { type: "PERCENT" | "FIXED"; value: number; note: string; amount: number }>
  >({});
  // Discount preset picker for bills and single orders
  const [discountModal, setDiscountModal] = useState<{
    billId?: number; billName?: string; total: number; currentAmount: number | null;
    orderId?: number;
  } | null>(null);
  const [discountPresets, setDiscountPresets] = useState<{ id: number; nameTh: string; type: string; value: number }[]>([]);
  const [discountPickType, setDiscountPickType] = useState<"PERCENT" | "FIXED">("FIXED");
  const [discountPickValue, setDiscountPickValue] = useState("");
  const [discountPickNote, setDiscountPickNote] = useState("");
  const [discountSaving, setDiscountSaving] = useState(false);
  // QR data URLs for scan-at-counter, keyed by order id
  const [qrMap, setQrMap] = useState<Record<number, string>>({});

  // Slip lightbox
  const [slipLightbox, setSlipLightbox] = useState<string | null>(null);

  // Edit modal state
  const [editOrder, setEditOrder] = useState<OrderWithItems | null>(null);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [editNote, setEditNote] = useState("");
  const [editBillId, setEditBillId] = useState<number | null | undefined>(undefined);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetch("/api/discounts").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setDiscountPresets(data.filter((d) => d.isActive));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    async function setupPush() {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      if (permission !== "granted") return;
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (!reg) return;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager
          .subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          })
          .catch(() => null));
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
      }
    }
    setupPush();
  }, []);

  useEffect(() => {
    fetch("/api/site-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.print_receipt) {
          try { setReceiptSettings({ ...DEFAULT_RECEIPT, ...JSON.parse(data.print_receipt) }); } catch {}
        }
        if (data.print_kitchen) {
          try { setKitchenSettings({ ...DEFAULT_KITCHEN, ...JSON.parse(data.print_kitchen) }); } catch {}
        }
        if (data.alert_sound_url) setAlertSoundUrl(data.alert_sound_url);
        if (data.kitchen_sound_url) setKitchenSoundUrl(data.kitchen_sound_url);
      })
      .catch(() => {});
  }, []);

  // Pre-fetch audio files as ArrayBuffer so we can play via AudioContext (avoids autoplay block)
  useEffect(() => {
    if (!alertSoundUrl) { alertBufRef.current = null; return; }
    fetch(alertSoundUrl).then((r) => r.arrayBuffer()).then((buf) => { alertBufRef.current = buf; }).catch(() => { alertBufRef.current = null; });
  }, [alertSoundUrl]);

  useEffect(() => {
    if (!kitchenSoundUrl) { kitchenBufRef.current = null; return; }
    fetch(kitchenSoundUrl).then((r) => r.arrayBuffer()).then((buf) => { kitchenBufRef.current = buf; }).catch(() => { kitchenBufRef.current = null; });
  }, [kitchenSoundUrl]);

  async function playCustom(bufRef: React.MutableRefObject<ArrayBuffer | null>) {
    if (!bufRef.current) return false;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      const decoded = await ctx.decodeAudioData(bufRef.current.slice(0));
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      src.start();
      return true;
    } catch { return false; }
  }

  // All PENDING orders where customer has selected a payment method (including TAB) — newest first
  const pendingOrders = (orders?.filter((o) => {
    if (o.status !== "PENDING") return false;
    const m = o.payment?.method;
    return m === "CASH" || m === "PROMPTPAY" || m === "TAB";
  }) ?? []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // TAB+billId pending orders grouped by bill (shown as a single grouped card)
  const pendingBillGroupsMap = new Map<number, OrderWithItems[]>();
  const regularPendingOrders: OrderWithItems[] = [];
  for (const order of pendingOrders) {
    if (order.billId && order.payment?.method === "TAB") {
      const grp = pendingBillGroupsMap.get(order.billId) ?? [];
      grp.push(order);
      pendingBillGroupsMap.set(order.billId, grp);
    } else {
      regularPendingOrders.push(order);
    }
  }

  // Orders that still need immediate staff action (alert beeps for these)
  // Cashier counter orders (handledById set) are excluded — staff created them intentionally
  const alertOrders = (orders ?? []).filter((o) => {
    if (o.handledById) return false; // counter order, staff already knows
    const m = o.payment?.method;
    // PENDING with payment method selected — needs staff to process
    if (o.status === "PENDING") return m === "CASH" || m === "PROMPTPAY" || m === "TAB";
    // CONFIRMED orders waiting for payment — includes bill-linked TAB (alert until paid)
    if (o.status === "CONFIRMED") return !m || m === "UNSET" || m === "CASH" || m === "PROMPTPAY" || (m === "TAB" && !!o.billId);
    return false;
  });

  // Only unacked alert orders trigger the loop — prevents loop restart on page navigation
  const unackedAlertOrderCount = alertOrders.filter((o) => !alertOrderAcked.has(o.id)).length;

  // Per-item kitchen-done alert: each item that finishes triggers the loop until acked.
  // Next item to finish triggers it again. "ยืนยันการเสิร์ฟ" (servedAcked) is separate.
  const kitchenReadyItems = (orders ?? []).flatMap((o) =>
    o.status === "SERVED" || o.status === "CANCELLED"
      ? []
      : o.items.filter((i) => !i.cancelledAt && i.kitchenServedAt && !kitchenItemAcked.has(i.id))
  );

  // Clean up servedAcked / kitchenItemAcked / alertOrderAcked for orders/items no longer active
  useEffect(() => {
    if (!orders) return;
    const activeOrderIds = new Set(orders.map((o) => o.id));
    const activeItemIds = new Set(orders.flatMap((o) => o.items.map((i) => i.id)));
    const activeAlertIds = new Set(
      orders.filter((o) => {
        if (o.handledById) return false;
        const m = o.payment?.method;
        if (o.status === "PENDING") return m === "CASH" || m === "PROMPTPAY" || m === "TAB";
        if (o.status === "CONFIRMED") return !m || m === "UNSET" || m === "CASH" || m === "PROMPTPAY" || (m === "TAB" && !!o.billId);
        return false;
      }).map((o) => o.id)
    );
    setServedAcked((prev) => {
      const next = new Set([...prev].filter((id) => activeOrderIds.has(id)));
      if (next.size !== prev.size) {
        try { localStorage.setItem("servedAcked", JSON.stringify([...next])); } catch {}
        return next;
      }
      return prev;
    });
    setKitchenItemAcked((prev) => {
      const next = new Set([...prev].filter((id) => activeItemIds.has(id)));
      if (next.size !== prev.size) {
        try { localStorage.setItem("kitchenItemAcked", JSON.stringify([...next])); } catch {}
        return next;
      }
      return prev;
    });
    setAlertOrderAcked((prev) => {
      const next = new Set([...prev].filter((id) => activeAlertIds.has(id)));
      if (next.size !== prev.size) {
        try { localStorage.setItem("alertOrderAcked", JSON.stringify([...next])); } catch {}
        return next;
      }
      return prev;
    });
  }, [orders]);

  // Fire beep when NEW orders arrive; fire chime when NEW kitchen-done events arrive
  useEffect(() => {
    if (!orders) return;

    // First render after page load: seed the refs with current state and skip notifications
    // so we don't pop up alerts for orders that were already there before the page opened.
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      prevIdsRef.current = new Set(orders.map((o) => o.id));
      prevKitchenDoneRef.current = new Set(
        orders.filter((o) => isKitchenDone(o.items) && o.items.filter((i) => !i.cancelledAt && i.menuItem.queueTarget !== "none").length > 0).map((o) => o.id)
      );
      return;
    }

    const newOrders = orders.filter((o) => {
      if (prevIdsRef.current.has(o.id)) return false;
      if (o.handledById) return false; // counter order — no alert
      const m = o.payment?.method;
      if (o.status === "CONFIRMED" || o.status === "PAID") return true;
      return o.status === "PENDING" && (m === "CASH" || m === "PROMPTPAY" || m === "TAB");
    });

    const newKitchenDone = orders.filter((o) => {
      if (prevKitchenDoneRef.current.has(o.id)) return false;
      const kitchenItems = o.items.filter((i) => !i.cancelledAt && i.menuItem.queueTarget !== "none");
      return kitchenItems.length > 0 && kitchenItems.every((i) => !!i.kitchenServedAt);
    });

    if (alertEnabled) {
      void (async () => {
        if (newOrders.length > 0) {
          try {
            const played = await playCustom(alertBufRef);
            if (!played) {
              if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
              try { if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume(); } catch {}
              playBeep(audioCtxRef.current);
            }
          } catch {}
          newOrders.forEach((o) =>
            showBrowserNotification(`🔔 ออเดอร์ใหม่`, o.orderName || `#${o.id}`)
          );
        }
        if (newKitchenDone.length > 0) {
          const played = await playCustom(kitchenBufRef);
          if (!played) playDoneChime();
          newKitchenDone.forEach((o) =>
            showBrowserNotification(`✅ อาหารพร้อม`, o.orderName || `#${o.id}`)
          );
        }
      })();
    }

    prevIdsRef.current = new Set(orders.map((o) => o.id));
    prevKitchenDoneRef.current = new Set(
      orders.filter((o) => {
        const kitchenItems = o.items.filter((i) => !i.cancelledAt && i.menuItem.queueTarget !== "none");
        return kitchenItems.length > 0 && kitchenItems.every((i) => !!i.kitchenServedAt);
      }).map((o) => o.id)
    );
  }, [orders, alertEnabled]);

  // Loop alert sound while there are unacked alert orders — stop when all acked or dismissed
  useEffect(() => {
    const hasAlerts = alertEnabled && unackedAlertOrderCount > 0;

    // Stop any existing loop
    if (alertLoopRef.current) {
      try { alertLoopRef.current.stop(); } catch {}
      alertLoopRef.current = null;
    }

    if (!hasAlerts) return;

    let cancelled = false;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    async function startLoop() {
      if (alertBufRef.current) {
        try {
          if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
          const ctx = audioCtxRef.current;
          if (ctx.state === "suspended") await ctx.resume();
          if (cancelled) return;
          const decoded = await ctx.decodeAudioData(alertBufRef.current.slice(0));
          if (cancelled) return;
          const src = ctx.createBufferSource();
          src.buffer = decoded;
          src.loop = true;
          src.connect(ctx.destination);
          src.start();
          if (cancelled) { try { src.stop(); } catch {} return; }
          alertLoopRef.current = src;
          return;
        } catch {}
      }
      // Fallback: synthesized beep on repeat
      if (!cancelled) {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        const beepCtx = audioCtxRef.current;
        try { if (beepCtx.state === "suspended") await beepCtx.resume(); } catch {}
        if (!cancelled) {
          playBeep(beepCtx);
          fallbackInterval = setInterval(() => {
            if (!cancelled) playBeep(beepCtx);
          }, 2500);
        }
      }
    }

    void startLoop();

    return () => {
      cancelled = true;
      if (alertLoopRef.current) {
        try { alertLoopRef.current.stop(); } catch {}
        alertLoopRef.current = null;
      }
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertEnabled, unackedAlertOrderCount > 0, alertSoundUrl]);

  // Loop kitchen chime while food-ready orders are unserved — stop when cleared
  useEffect(() => {
    const hasReady = alertEnabled && kitchenReadyItems.length > 0;

    if (kitchenLoopRef.current) {
      try { kitchenLoopRef.current.stop(); } catch {}
      kitchenLoopRef.current = null;
    }

    if (!hasReady) return;

    let cancelled = false;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    async function startLoop() {
      if (kitchenBufRef.current) {
        try {
          if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
          const ctx = audioCtxRef.current;
          if (ctx.state === "suspended") await ctx.resume();
          if (cancelled) return;
          const decoded = await ctx.decodeAudioData(kitchenBufRef.current.slice(0));
          if (cancelled) return;
          const src = ctx.createBufferSource();
          src.buffer = decoded;
          src.loop = true;
          src.connect(ctx.destination);
          src.start();
          if (cancelled) { try { src.stop(); } catch {} return; }
          kitchenLoopRef.current = src;
          return;
        } catch {}
      }
      // Fallback: chime on repeat
      if (!cancelled) {
        playDoneChime();
        fallbackInterval = setInterval(() => {
          if (!cancelled) playDoneChime();
        }, 2500);
      }
    }

    void startLoop();

    return () => {
      cancelled = true;
      if (kitchenLoopRef.current) {
        try { kitchenLoopRef.current.stop(); } catch {}
        kitchenLoopRef.current = null;
      }
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertEnabled, kitchenReadyItems.length > 0, kitchenSoundUrl]);

  function setLoading(id: number, on: boolean) {
    setLoadingIds((prev) => {
      const s = new Set(prev);
      on ? s.add(id) : s.delete(id);
      return s;
    });
  }

  async function updateStatus(orderId: number, status: string) {
    if (loadingIds.has(orderId)) return;
    ackAlertOrders([orderId]);
    setLoading(orderId, true);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await mutate();
    } finally {
      setLoading(orderId, false);
    }
  }

  // handleUpdate intercepts actions that need confirmation
  function handleUpdate(orderId: number, status: string) {
    if (status === "CANCELLED") {
      setConfirmAction({
        message: "ยืนยันการยกเลิกออเดอร์?",
        detail: "ออเดอร์จะถูกยกเลิกทันที",
        confirmLabel: "ยกเลิกออเดอร์",
        confirmColor: "bg-red-500 text-white",
        onConfirm: () => updateStatus(orderId, status),
      });
    } else if (status === "PAID") {
      setConfirmAction({
        message: "ยืนยันว่าลูกค้าชำระเงินแล้ว?",
        detail: "ตรวจสอบยอดเงินให้ถูกต้องก่อนยืนยัน",
        confirmLabel: "ยืนยันการชำระ",
        confirmColor: "bg-green-600 text-white",
        onConfirm: () => updateStatus(orderId, status),
      });
    } else {
      updateStatus(orderId, status);
    }
  }

  async function deleteOrder(orderId: number) {
    setLoading(orderId, true);
    try {
      await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      await Promise.all([mutate(), mutateTodayOrders()]);
    } finally {
      setLoading(orderId, false);
    }
  }

  function handleDelete(orderId: number) {
    setConfirmAction({
      message: "ลบออเดอร์ถาวร?",
      detail: "ข้อมูลออเดอร์จะหายไปและไม่สามารถกู้คืนได้",
      confirmLabel: "ลบถาวร",
      confirmColor: "bg-red-600 text-white",
      onConfirm: () => deleteOrder(orderId),
    });
  }

  async function purgeBill(billId: number) {
    try {
      await fetch(`/api/pos/bills/${billId}/purge`, { method: "DELETE" });
      await Promise.all([mutate(), mutateTodayOrders()]);
    } catch (e) {
      console.error("purgeBill failed", e);
    }
  }

  function handlePurge(orderId: number, billId?: number | null) {
    const hasBill = !!billId;
    setConfirmAction({
      message: "⚠️ ทำลายข้อมูลถาวร?",
      detail: hasBill
        ? "บิล ออเดอร์ทั้งหมด เซสชันผู้เล่น ใบเสร็จ และการชำระเงินจะถูกลบออกจากระบบถาวร"
        : "ออเดอร์ รายการ และการชำระเงินจะถูกลบออกจากระบบถาวร",
      confirmLabel: "ยืนยัน — ขั้นที่ 1",
      confirmColor: "bg-red-500 text-white",
      onConfirm: () => {
        setConfirmAction({
          message: "⛔ ยืนยันอีกครั้ง",
          detail: "ข้อมูลทั้งหมดจะหายถาวร ไม่สามารถกู้คืนได้",
          confirmLabel: "ทำลายเลย",
          confirmColor: "bg-red-700 text-white",
          onConfirm: () => hasBill ? purgeBill(billId!) : deleteOrder(orderId),
        });
      },
    });
  }

  function openCashModal(order: OrderWithItems) {
    ackAlertOrders([order.id]);
    setCashOrder(order);
    setCashInputStr("");
  }

  async function confirmCashPayment() {
    if (!cashOrder) return;
    const received = parseInt(cashInputStr.replace(/,/g, ""), 10) || 0;
    const discAmt = orderDiscounts[cashOrder.id]?.amount ?? 0;
    const finalTotal = cashOrder.totalTHB - discAmt;
    if (finalTotal > 0 && received < finalTotal) return;
    const change = received - finalTotal;
    const order = cashOrder;
    setLoading(order.id, true);
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmCash: true, receivedAmount: received, changeAmount: change, ...(discAmt > 0 ? { amountTHB: finalTotal } : {}) }),
    });
    setCashOrder(null);
    setCashInputStr("");
    await mutate();
    setLoading(order.id, false);
  }

  async function handleBillGroupConfirm(grpOrders: OrderWithItems[]) {
    const ids = grpOrders.map((o) => o.id);
    setLoadingIds((prev) => new Set([...prev, ...ids]));
    try {
      await Promise.all(
        grpOrders.map((o) =>
          fetch(`/api/orders/${o.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "CONFIRMED" }),
          })
        )
      );
      ackAlertOrders(ids);
      await mutate();
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  function calcDiscountAmount(total: number): number {
    const n = Number(discount.value);
    if (!n || n <= 0) return 0;
    if (discount.type === "PERCENT") return Math.round(total * Math.min(n, 100) / 100);
    return Math.min(n, total);
  }

  function resetDiscount() {
    setDiscount({ type: "PERCENT", value: "", note: "" });
  }

  function openOrderDiscountModal(order: OrderWithItems) {
    const existing = orderDiscounts[order.id];
    setDiscountPickType(existing?.type ?? "FIXED");
    setDiscountPickValue(existing ? String(existing.value) : "");
    setDiscountPickNote(existing?.note ?? "");
    setDiscountModal({ orderId: order.id, total: order.totalTHB, currentAmount: existing?.amount ?? null });
  }

  function removeOrderDiscount(orderId: number) {
    setOrderDiscounts((prev) => { const n = { ...prev }; delete n[orderId]; return n; });
  }

  function openDiscountModal(orders: OrderWithItems[]) {
    const bill = orders[0].bill;
    const total = orders.reduce((s, o) => s + o.totalTHB, 0);
    if (bill?.discountType && bill?.discountValue) {
      setDiscountPickType(bill.discountType as "PERCENT" | "FIXED");
      setDiscountPickValue(String(bill.discountValue));
      setDiscountPickNote(bill.discountNote ?? "");
    } else {
      setDiscountPickType("FIXED");
      setDiscountPickValue("");
      setDiscountPickNote("");
    }
    setDiscountModal({ billId: bill?.id ?? orders[0].billId!, billName: bill?.name ?? "", total, currentAmount: bill?.discountAmount ?? null });
  }

  async function applyBillDiscount() {
    if (!discountModal) return;
    const n = Number(discountPickValue);
    if (!n || n <= 0) return;

    // Single-order mode: store in local state, no API call
    if (discountModal.orderId != null) {
      const rawTotal = discountModal.total;
      const amount = discountPickType === "PERCENT"
        ? Math.round(rawTotal * Math.min(n, 100) / 100)
        : Math.min(n, rawTotal);
      setOrderDiscounts((prev) => ({
        ...prev,
        [discountModal.orderId!]: { type: discountPickType, value: n, note: discountPickNote.trim(), amount },
      }));
      setDiscountModal(null);
      return;
    }

    // Bill mode: persist to DB
    setDiscountSaving(true);
    try {
      await fetch(`/api/pos/bills/${discountModal.billId}/set-discount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountType: discountPickType, discountValue: n, ...(discountPickNote.trim() ? { discountNote: discountPickNote.trim() } : {}) }),
      });
      setDiscountModal(null);
      await mutate();
    } finally {
      setDiscountSaving(false);
    }
  }

  async function removeBillDiscount(billId: number) {
    await fetch(`/api/pos/bills/${billId}/set-discount`, { method: "DELETE" });
    await mutate();
  }

  function discountBody() {
    const n = Number(discount.value);
    if (!n || n <= 0) return {};
    return {
      discountType: discount.type,
      discountValue: n,
      ...(discount.note.trim() ? { discountNote: discount.note.trim() } : {}),
    };
  }

  async function confirmBillGroupCash() {
    if (!billGroupCash) return;
    const finalTotal = billGroupCash.total - calcDiscountAmount(billGroupCash.total);
    const received = parseInt(billCashInputStr.replace(/,/g, ""), 10) || 0;
    if (finalTotal > 0 && received < finalTotal) return;
    const snapshot = billGroupCash;
    setBillGroupCashLoading(true);
    try {
      await fetch(`/api/pos/bills/${snapshot.billId}/tab-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUserId: null, paymentMethod: "CASH", ...discountBody() }),
      });
      setBillGroupCash(null);
      setBillCashInputStr("");
      resetDiscount();
      await mutate();
    } finally {
      setBillGroupCashLoading(false);
    }
  }

  async function confirmBillGroupScan() {
    if (!billGroupScan) return;
    const snapshot = billGroupScan;
    setBillScanLoading(true);
    try {
      await fetch(`/api/pos/bills/${snapshot.billId}/tab-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUserId: null, paymentMethod: "PROMPTPAY", ...discountBody() }),
      });
      setBillGroupScan(null);
      resetDiscount();
      await mutate();
    } finally {
      setBillScanLoading(false);
    }
  }

  async function confirmBillGroupSplit() {
    if (!billGroupSplit) return;
    const snapshot = billGroupSplit;
    setSplitLoading(true);
    try {
      await fetch(`/api/pos/bills/${snapshot.billId}/tab-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUserId: null, paymentMethod: "PROMPTPAY", ...discountBody() }),
      });
      setBillGroupSplit(null);
      setSplitCashStr("");
      setSplitReceivedStr("");
      resetDiscount();
      await mutate();
    } finally {
      setSplitLoading(false);
    }
  }

  async function confirmQrPayment(order: OrderWithItems) {
    if (!order.payment?.id) return;
    ackAlertOrders([order.id]);
    setLoading(order.id, true);
    await fetch("/api/payment/confirm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: order.payment.id }),
    });
    await mutate();
    setLoading(order.id, false);
  }

  // Cashier picked "สแกน": confirm order (if still PENDING), then generate QR and lock method to PROMPTPAY
  async function resetPaymentMethod(order: OrderWithItems) {
    setLoading(order.id, true);
    try {
      await fetch(`/api/payment?orderId=${order.id}`, { method: "DELETE" });
      setQrMap((prev) => { const next = { ...prev }; delete next[order.id]; return next; });
      await mutate();
    } finally {
      setLoading(order.id, false);
    }
  }

  async function chooseScan(order: OrderWithItems) {
    setLoading(order.id, true);
    try {
      // If order is still PENDING (e.g. online counter-payment order), confirm it first
      if (order.status === "PENDING") {
        await fetch(`/api/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CONFIRMED" }),
        });
      }
      const discountAmount = orderDiscounts[order.id]?.amount ?? 0;
      const res = await fetch("/api/payment/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, ...(discountAmount > 0 ? { discountAmount } : {}) }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.qrDataUrl) setQrMap((prev) => ({ ...prev, [order.id]: data.qrDataUrl }));
      }
      await mutate();
    } finally {
      setLoading(order.id, false);
    }
  }

  function openEdit(order: OrderWithItems) {
    setEditOrder(order);
    setEditItems(
      order.items
        .filter((item) => !item.cancelledAt)
        .map((item) => ({
          id: item.id,
          nameTh: item.menuItem.nameTh,
          selectedSize: item.selectedSize,
          unitPrice: item.unitPriceTHB,
          quantity: item.quantity,
        }))
    );
    setEditNote(order.note ?? "");
    setEditBillId(undefined); // undefined = no change
  }

  function changeQty(itemId: number, delta: number) {
    setEditItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
      )
    );
  }

  async function saveEdit() {
    if (!editOrder || savingEdit) return;
    const hasItems = editItems.some((i) => i.quantity > 0);
    if (!hasItems) {
      alert("ต้องมีสินค้าอย่างน้อย 1 รายการ หรือลบออเดอร์แทน");
      return;
    }
    setSavingEdit(true);
    try {
      const body: Record<string, unknown> = {
        items: editItems.map((i) => ({ id: i.id, quantity: i.quantity })),
        note: editNote,
      };
      if (editBillId !== undefined) body.newBillId = editBillId;
      await fetch(`/api/orders/${editOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await mutate();
      setEditOrder(null);
    } finally {
      setSavingEdit(false);
    }
  }

  const activeOrders = (orders?.filter((o) => o.status !== "PENDING") ?? [])
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Group CONFIRMED+TAB orders from the same bill into one card
  const billTabGroupsMap = new Map<number, OrderWithItems[]>();
  const standaloneActive: OrderWithItems[] = [];
  for (const order of activeOrders) {
    if (order.billId && order.payment?.method === "TAB" && order.status === "CONFIRMED") {
      const grp = billTabGroupsMap.get(order.billId) ?? [];
      grp.push(order);
      billTabGroupsMap.set(order.billId, grp);
    } else {
      standaloneActive.push(order);
    }
  }

  type ActiveDisplayItem =
    | { kind: "group"; billId: number; orders: OrderWithItems[]; ts: number }
    | { kind: "single"; order: OrderWithItems; ts: number };

  const activeDisplayItems: ActiveDisplayItem[] = [
    ...[...billTabGroupsMap.entries()].map(([billId, orders]) => ({
      kind: "group" as const, billId, orders,
      ts: Math.max(...orders.map((o) => new Date(o.createdAt).getTime())),
    })),
    ...standaloneActive.map((order) => ({
      kind: "single" as const, order,
      ts: new Date(order.createdAt).getTime(),
    })),
  ].sort((a, b) => b.ts - a.ts);

  if (!orders) return <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>;

  const editTotal = editItems
    .filter((i) => i.quantity > 0)
    .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);


  return (
    <div className="space-y-6">
      {/* Alert toggle */}
      <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">{alertEnabled ? "🔔" : "🔕"}</span>
          <div>
            <p className="text-sm font-medium text-navy">เสียงแจ้งเตือนออเดอร์ใหม่</p>
            <p className="text-xs text-gray-400">ดังเมื่อมีออเดอร์เข้าใหม่</p>
          </div>
        </div>
        <button
          onClick={() => setAlertEnabled((v) => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors ${alertEnabled ? "bg-orange" : "bg-gray-300"}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${alertEnabled ? "left-5" : "left-0.5"}`}
          />
        </button>
      </div>

      {/* Dismiss loop button — shows only while unacked alert orders are ringing */}
      {alertEnabled && unackedAlertOrderCount > 0 && (
        <button
          onClick={() => ackAlertOrders(alertOrders.map((o) => o.id))}
          className="w-full flex items-center justify-center gap-2 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 font-bold py-2.5 rounded-xl text-sm transition-colors"
        >
          🔕 ปิดเสียงแจ้งเตือน ({unackedAlertOrderCount} รายการ)
        </button>
      )}

      {/* ออเดอร์ใหม่ PENDING */}
      {pendingOrders.length > 0 && (
        <div>
          <h3 className="font-bold text-navy mb-3 flex items-center gap-2">
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
              {pendingOrders.length} ใหม่
            </span>
            รอรับออเดอร์
          </h3>
          <div className="space-y-3">
            {/* Grouped pending TAB+bill orders — accept all at once */}
            {[...pendingBillGroupsMap.entries()].map(([billId, grpOrders]) => {
              const bill = grpOrders[0]?.bill;
              const total = grpOrders.reduce((s, o) => s + o.totalTHB, 0);
              const allItems = grpOrders.flatMap((o) => o.items);
              const isLoading = grpOrders.some((o) => loadingIds.has(o.id));
              return (
                <div key={`pbill-${billId}`} className="bg-white rounded-2xl shadow-sm border-l-4 border-orange overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="font-bold text-navy">ตี้ {bill?.name ?? billId}</span>
                        {bill?.table && <span className="text-sm text-gray-400 ml-1">· โต๊ะ {bill.table.number}</span>}
                      </div>
                      <span className="bg-orange/10 text-orange text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                        {grpOrders.length} ออเดอร์ใหม่
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">รวมบิล TAB · ฿{total.toLocaleString()}</p>
                    <div className="space-y-0.5 mb-3">
                      {allItems.slice(0, 6).map((item) => (
                        <p key={item.id} className="text-xs text-gray-600">
                          • {item.menuItem.nameTh}{item.selectedSize ? ` (${item.selectedSize})` : ""} ×{item.quantity}
                        </p>
                      ))}
                      {allItems.length > 6 && (
                        <p className="text-xs text-gray-400">+ อีก {allItems.length - 6} รายการ</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleBillGroupConfirm(grpOrders)}
                      disabled={isLoading}
                      className="w-full bg-green-500 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      {isLoading ? "กำลังรับออเดอร์..." : `✅ รับออเดอร์ทั้งหมด (${grpOrders.length} ออเดอร์)`}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Regular pending orders (CASH / PROMPTPAY / TAB without bill) */}
            {regularPendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isNew
                isLoading={loadingIds.has(order.id)}
                onUpdate={handleUpdate}
                onEdit={openEdit}
                onDelete={handleDelete}
                onPurge={handlePurge}
                onPrint={(o) => printReceipt(o, receiptSettings)}
                onSplitOrder={(o) => { setOrderSplit({ order: o, step: "cash-portion", cashPaid: 0 }); setOrderSplitCashStr(""); setOrderSplitReceivedStr(""); }}
                onKitchen={(o) => printKitchen(o, kitchenSettings)}
                kitchenEnabled={kitchenSettings.enabled}
                onOpenCashModal={openCashModal}
                onConfirmQr={confirmQrPayment}
                onChooseScan={chooseScan}
                onResetPayment={resetPaymentMethod}
                qrUrl={qrMap[order.id]}
                servedAcked={servedAcked}
                onServeAck={markServedAck}
                kitchenItemAcked={kitchenItemAcked}
                onAckKitchenItems={ackKitchenItems}
                onOpenSlip={setSlipLightbox}
                onSetOrderDiscount={openOrderDiscountModal}
                onRemoveOrderDiscount={removeOrderDiscount}
                orderDiscountAmount={orderDiscounts[order.id]?.amount}
              />
            ))}
          </div>
        </div>
      )}

      {/* ออเดอร์กำลังดำเนินการ */}
      {activeDisplayItems.length > 0 && (
        <div>
          <h3 className="font-bold text-navy mb-3">กำลังดำเนินการ</h3>
          <div className="space-y-3">
            {activeDisplayItems.map((item) =>
              item.kind === "group" ? (
                <BillOrderGroupCard
                  key={`bill-${item.billId}`}
                  orders={item.orders}
                  servedAcked={servedAcked}
                  onServeAck={markServedAck}
                  isLoading={item.orders.some((o) => loadingIds.has(o.id))}
                  onOpenCashModal={(orders) => {
                    ackAlertOrders(orders.map((o) => o.id));
                    setBillGroupCash({
                      billId: orders[0].billId!,
                      billName: orders[0].bill?.name ?? "",
                      orders,
                      total: orders.reduce((s, o) => s + o.totalTHB, 0),
                    });
                    setBillCashInputStr("");
                    const b = orders[0].bill;
                    if (b?.discountType && b?.discountValue) {
                      setDiscount({ type: b.discountType as "PERCENT" | "FIXED", value: String(b.discountValue), note: b.discountNote ?? "" });
                    } else { resetDiscount(); }
                  }}
                  onScanCheckout={(orders) => {
                    ackAlertOrders(orders.map((o) => o.id));
                    setBillGroupScan({
                      billId: orders[0].billId!,
                      billName: orders[0].bill?.name ?? "",
                      orders,
                      total: orders.reduce((s, o) => s + o.totalTHB, 0),
                    });
                    const b = orders[0].bill;
                    if (b?.discountType && b?.discountValue) {
                      setDiscount({ type: b.discountType as "PERCENT" | "FIXED", value: String(b.discountValue), note: b.discountNote ?? "" });
                    } else { resetDiscount(); }
                  }}
                  onSplitCheckout={(orders) => {
                    ackAlertOrders(orders.map((o) => o.id));
                    setBillGroupSplit({
                      billId: orders[0].billId!,
                      billName: orders[0].bill?.name ?? "",
                      orders,
                      total: orders.reduce((s, o) => s + o.totalTHB, 0),
                      step: "cash-portion",
                      cashPaid: 0,
                    });
                    setSplitCashStr("");
                    setSplitReceivedStr("");
                    resetDiscount();
                  }}
                  onSetDiscount={openDiscountModal}
                  onRemoveDiscount={removeBillDiscount}
                  onPurgeBill={(billId) => handlePurge(0, billId)}
                  kitchenItemAcked={kitchenItemAcked}
                  onAckKitchenItems={ackKitchenItems}
                  onPrintReceipt={(orders) => void printBillGroupReceipt(orders, receiptSettings)}
                  onEdit={openEdit}
                  onCancelOrder={(id) => handleUpdate(id, "CANCELLED")}
                />
              ) : (
                <OrderCard
                  key={item.order.id}
                  order={item.order}
                  isNew={false}
                  isLoading={loadingIds.has(item.order.id)}
                  onUpdate={handleUpdate}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onPurge={handlePurge}
                  onPrint={(o) => printReceipt(o, receiptSettings)}
                  onSplitOrder={(o) => { setOrderSplit({ order: o, step: "cash-portion", cashPaid: 0 }); setOrderSplitCashStr(""); setOrderSplitReceivedStr(""); }}
                  onKitchen={(o) => printKitchen(o, kitchenSettings)}
                  kitchenEnabled={kitchenSettings.enabled}
                  onOpenCashModal={openCashModal}
                  onConfirmQr={confirmQrPayment}
                  onChooseScan={chooseScan}
                  onResetPayment={resetPaymentMethod}
                  qrUrl={qrMap[item.order.id]}
                  servedAcked={servedAcked}
                  onServeAck={markServedAck}
                  kitchenItemAcked={kitchenItemAcked}
                  onAckKitchenItems={ackKitchenItems}
                  onOpenSlip={setSlipLightbox}
                  onSetOrderDiscount={openOrderDiscountModal}
                  onRemoveOrderDiscount={removeOrderDiscount}
                  orderDiscountAmount={orderDiscounts[item.order.id]?.amount}
                />
              )
            )}
          </div>
        </div>
      )}

      {orders.length === 0 && pendingOrders.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <p className="text-4xl mb-2">🎲</p>
          <p>ยังไม่มีออเดอร์</p>
        </div>
      )}

      {/* ประวัติออเดอร์วันนี้ */}
      <div className="border-t border-sand pt-4">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="flex items-center justify-between w-full"
        >
          <h3 className="font-bold text-navy flex items-center gap-2">
            📋 ออเดอร์วันนี้ที่เสร็จแล้ว
            {todayOrders && todayOrders.length > 0 && (
              <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                {todayOrders.length} รายการ
              </span>
            )}
          </h3>
          <span className="text-gray-400 text-sm">{showHistory ? "▲ ซ่อน" : "▼ ดู"}</span>
        </button>

        {showHistory && (
          <div className="mt-3 space-y-2">
            {!todayOrders || todayOrders.length === 0 ? (
              <p className="text-center text-gray-400 py-6 text-sm">ยังไม่มีออเดอร์ที่เสร็จแล้ววันนี้</p>
            ) : (() => {
              // Group orders by billId (same bill → one card)
              const billHistoryMap = new Map<number, OrderWithItems[]>();
              const standaloneHistory: OrderWithItems[] = [];
              for (const order of todayOrders) {
                if (order.billId) {
                  const grp = billHistoryMap.get(order.billId) ?? [];
                  grp.push(order);
                  billHistoryMap.set(order.billId, grp);
                } else {
                  standaloneHistory.push(order);
                }
              }
              const historyItems = [
                ...[...billHistoryMap.entries()].map(([billId, grpOrders]) => ({
                  kind: "billGroup" as const, billId, orders: grpOrders,
                  ts: Math.max(...grpOrders.map((o) => new Date(o.createdAt).getTime())),
                })),
                ...standaloneHistory.map((order) => ({
                  kind: "single" as const, order,
                  ts: new Date(order.createdAt).getTime(),
                })),
              ].sort((a, b) => b.ts - a.ts);

              return historyItems.map((item) => {
                if (item.kind === "billGroup") {
                  const { orders: grpOrders } = item;
                  const bill = grpOrders[0]?.bill;
                  const bc = BILL_COLOR_MAP[bill?.color ?? "indigo"] ?? BILL_COLOR_MAP.indigo;
                  const totalTHB = grpOrders.reduce((s, o) => s + o.totalTHB, 0);
                  const allItems = grpOrders.flatMap((o) => o.items.filter((i) => !i.cancelledAt));
                  return (
                    <div key={`hist-bill-${item.billId}`} className="bg-white rounded-xl p-4 shadow-sm opacity-80">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className={`inline-block font-black text-sm px-2.5 py-0.5 rounded-full ${bc.bg} ${bc.text} mb-1`}>
                            ตี้ {bill?.name}
                          </span>
                          <p className="text-xs text-gray-400">โต๊ะ {bill?.table.number} · {grpOrders.length} ออเดอร์</p>
                          <p className="text-xs text-gray-400">{formatThaiDateTime(grpOrders[0].createdAt)}</p>
                        </div>
                        <p className="font-bold text-navy">฿{totalTHB.toLocaleString()}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 space-y-1">
                        {allItems.slice(0, 8).map((item, i) => (
                          <div key={i} className="flex justify-between text-xs text-gray-600">
                            <span>{item.menuItem.nameTh}{item.selectedSize ? ` (${item.selectedSize})` : ""} ×{item.quantity}</span>
                            <span>฿{item.unitPriceTHB * item.quantity}</span>
                          </div>
                        ))}
                        {allItems.length > 8 && <p className="text-xs text-gray-400">+ อีก {allItems.length - 8} รายการ</p>}
                        <div className="border-t border-gray-200 pt-1 flex justify-between text-sm font-bold text-navy">
                          <span>รวมทั้งหมด</span>
                          <span>฿{totalTHB.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-3">
                        <button onClick={() => void printBillGroupReceipt(grpOrders, receiptSettings)} className="text-xs text-gray-500 hover:text-gray-700">
                          🖨️ พิมพ์ใบเสร็จรวมบิล
                        </button>
                      </div>
                    </div>
                  );
                }
                const { order } = item;
                return (
                  <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm opacity-80">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-navy">👤 {order.orderName || `ออเดอร์ #${order.id}`}</p>
                        <p className="text-xs text-gray-400">{formatThaiDateTime(order.createdAt)}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.color ?? "bg-gray-100 text-gray-500"}`}>
                        {STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.label ?? order.status}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 space-y-1">
                      {order.items.filter((i) => !i.cancelledAt).map((item) => (
                        <div key={item.id} className="flex justify-between text-xs text-gray-600">
                          <span>{item.menuItem.nameTh} ×{item.quantity}</span>
                          <span>฿{item.unitPriceTHB * item.quantity}</span>
                        </div>
                      ))}
                      {(() => {
                        const disc = order.discountAmount ?? orderDiscounts[order.id]?.amount ?? 0;
                        return disc > 0 ? (
                          <>
                            <div className="border-t border-gray-200 pt-1 flex justify-between text-xs text-gray-500">
                              <span>ยอดรวม</span><span>฿{order.totalTHB}</span>
                            </div>
                            <div className="flex justify-between text-xs text-emerald-600">
                              <span>ส่วนลด</span><span>−฿{disc}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-navy">
                              <span>สุทธิ</span><span>฿{order.totalTHB - disc}</span>
                            </div>
                          </>
                        ) : (
                          <div className="border-t border-gray-200 pt-1 flex justify-between text-sm font-bold text-navy">
                            <span>รวม</span><span>฿{order.totalTHB}</span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="mt-2 flex gap-3">
                      <button onClick={() => printReceipt(order, receiptSettings)} className="text-xs text-gray-500 hover:text-gray-700">
                        🖨️ พิมพ์ใบเสร็จ
                      </button>
                      <button onClick={() => handleDelete(order.id)} disabled={loadingIds.has(order.id)} className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40">
                        🗑️ ลบ
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Cash payment modal */}
      {cashOrder && (() => {
        const orderDisc = orderDiscounts[cashOrder.id];
        const discAmt = orderDisc?.amount ?? 0;
        const finalTotal = cashOrder.totalTHB - discAmt;
        const received = parseInt(cashInputStr.replace(/,/g, ""), 10) || 0;
        const change = received - finalTotal;
        function pressDigit(d: string) {
          setCashInputStr((prev) => (prev === "" || prev === "0") ? d : prev + d);
        }
        function pressZero() {
          setCashInputStr((prev) => prev === "" ? "" : prev + "0");
        }
        function pressBack() {
          setCashInputStr((prev) => prev.slice(0, -1));
        }
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl space-y-3">
              <h3 className="font-bold text-navy text-lg text-center">รับเงินสด</h3>
              <p className="text-sm text-center text-gray-500">{cashOrder.orderName}</p>
              <div className="text-center">
                <p className="text-xs text-gray-400">ยอดที่ต้องชำระ</p>
                {discAmt > 0 && <p className="text-xs text-gray-400 line-through">฿{cashOrder.totalTHB.toLocaleString()}</p>}
                {discAmt > 0 && <p className="text-xs text-green-600 font-semibold">💸 {orderDisc!.note || "ส่วนลด"} −฿{discAmt.toLocaleString()}</p>}
                <p className="text-3xl font-bold text-orange">฿{finalTotal.toLocaleString()}</p>
              </div>

              {/* Amount display */}
              <div className="w-full border-2 border-sand rounded-xl px-4 py-3 text-2xl font-bold text-navy text-center bg-gray-50 min-h-[56px]">
                {cashInputStr ? `฿${received.toLocaleString()}` : <span className="text-gray-300">฿0</span>}
              </div>

              {/* Change / shortfall */}
              {cashInputStr && (
                <div className={`rounded-xl p-2.5 text-center ${received >= finalTotal ? "bg-green-50" : "bg-red-50"}`}>
                  {received >= finalTotal ? (
                    <><p className="text-xs text-green-600">เงินทอน</p><p className="text-2xl font-bold text-green-700">฿{change.toLocaleString()}</p></>
                  ) : (
                    <p className="text-sm font-semibold text-red-500">ขาดอีก ฿{(finalTotal - received).toLocaleString()}</p>
                  )}
                </div>
              )}

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-1.5">
                {["1","2","3","4","5","6","7","8","9"].map((d) => (
                  <button key={d} type="button" onClick={() => pressDigit(d)}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">
                    {d}
                  </button>
                ))}
                <button type="button"
                  onClick={() => setCashInputStr((prev) => prev === "" ? "" : prev + "00")}
                  className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">
                  00
                </button>
                <button type="button" onClick={pressZero}
                  className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">
                  0
                </button>
                <button type="button" onClick={pressBack}
                  className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">
                  ⌫
                </button>
              </div>

              {/* Quick-add shortcuts */}
              <div className="grid grid-cols-6 gap-1.5">
                {[20, 50, 100, 500, 1000].map((amt) => (
                  <button key={amt} type="button"
                    onClick={() => setCashInputStr(String((parseInt(cashInputStr) || 0) + amt))}
                    className="bg-orange/10 hover:bg-orange/20 border border-orange/20 text-orange text-xs font-semibold py-2 rounded-xl select-none">
                    +{amt}
                  </button>
                ))}
                <button type="button" onClick={() => setCashInputStr("")}
                  className="bg-sand/50 border border-sand text-gray-400 text-xs font-semibold py-2 rounded-xl select-none">
                  ล้าง
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => { setCashOrder(null); setCashInputStr(""); }}
                  className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm font-semibold">ยกเลิก</button>
                <button onClick={confirmCashPayment}
                  disabled={finalTotal > 0 && (!cashInputStr || received < finalTotal)}
                  className="flex-1 bg-green-600 text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40">
                  ✅ ลูกค้าชำระแล้ว
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bill group cash modal */}
      {billGroupCash && (() => {
        const discAmt = calcDiscountAmount(billGroupCash.total);
        const finalTotal = billGroupCash.total - discAmt;
        const received = parseInt(billCashInputStr.replace(/,/g, ""), 10) || 0;
        const change = received - finalTotal;
        function pressDigit(d: string) { setBillCashInputStr((prev) => (prev === "" || prev === "0") ? d : prev + d); }
        function pressBack() { setBillCashInputStr((prev) => prev.slice(0, -1)); }
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl space-y-3 my-4">
              <h3 className="font-bold text-navy text-lg text-center">รับเงินสด — ตี้ {billGroupCash.billName}</h3>
              <p className="text-xs text-center text-gray-400">{billGroupCash.orders.length} ออเดอร์รวมกัน</p>

              {/* Discount section */}
              <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500">ส่วนลด (ถ้ามี)</p>
                <div className="flex gap-1.5">
                  <button type="button"
                    onClick={() => setDiscount((d) => ({ ...d, type: "PERCENT" }))}
                    className={`flex-1 py-1.5 rounded-xl text-sm font-bold border transition-colors ${discount.type === "PERCENT" ? "bg-orange text-white border-orange" : "bg-white border-sand text-gray-400"}`}>
                    %
                  </button>
                  <button type="button"
                    onClick={() => setDiscount((d) => ({ ...d, type: "FIXED" }))}
                    className={`flex-1 py-1.5 rounded-xl text-sm font-bold border transition-colors ${discount.type === "FIXED" ? "bg-orange text-white border-orange" : "bg-white border-sand text-gray-400"}`}>
                    ฿
                  </button>
                  <input
                    type="number"
                    min={0}
                    placeholder={discount.type === "PERCENT" ? "0–100" : "0"}
                    value={discount.value}
                    onChange={(e) => setDiscount((d) => ({ ...d, value: e.target.value }))}
                    className="w-24 border border-sand rounded-xl px-2 py-1.5 text-sm text-center text-navy font-bold bg-white"
                  />
                </div>
                <input
                  type="text"
                  placeholder="หมายเหตุ เช่น สมาชิก, นักเรียน"
                  value={discount.note}
                  onChange={(e) => setDiscount((d) => ({ ...d, note: e.target.value }))}
                  className="w-full border border-sand rounded-xl px-3 py-1.5 text-xs text-gray-600 bg-white"
                />
                {/* Summary */}
                <div className="text-center pt-1">
                  {discAmt > 0 ? (
                    <div className="space-y-0.5">
                      <p className="text-xs text-gray-400 line-through">฿{billGroupCash.total.toLocaleString()}</p>
                      <p className="text-xs text-green-600">ส่วนลด −฿{discAmt.toLocaleString()}</p>
                      <p className="text-2xl font-bold text-orange">฿{finalTotal.toLocaleString()}</p>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-orange">฿{billGroupCash.total.toLocaleString()}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">ยอดที่ต้องชำระ</p>
                </div>
              </div>

              <div className="w-full border-2 border-sand rounded-xl px-4 py-3 text-2xl font-bold text-navy text-center bg-gray-50 min-h-[56px]">
                {billCashInputStr ? `฿${received.toLocaleString()}` : <span className="text-gray-300">฿0</span>}
              </div>
              {billCashInputStr && (
                <div className={`rounded-xl p-2.5 text-center ${received >= finalTotal ? "bg-green-50" : "bg-red-50"}`}>
                  {received >= finalTotal
                    ? <><p className="text-xs text-green-600">เงินทอน</p><p className="text-2xl font-bold text-green-700">฿{change.toLocaleString()}</p></>
                    : <p className="text-sm font-semibold text-red-500">ขาดอีก ฿{(finalTotal - received).toLocaleString()}</p>}
                </div>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                {["1","2","3","4","5","6","7","8","9"].map((d) => (
                  <button key={d} type="button" onClick={() => pressDigit(d)}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">{d}</button>
                ))}
                <button type="button" onClick={() => setBillCashInputStr((p) => p === "" ? "" : p + "00")}
                  className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">00</button>
                <button type="button" onClick={() => pressDigit("0")}
                  className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">0</button>
                <button type="button" onClick={pressBack}
                  className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">⌫</button>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {[20, 50, 100, 500, 1000].map((amt) => (
                  <button key={amt} type="button" onClick={() => setBillCashInputStr(String((parseInt(billCashInputStr) || 0) + amt))}
                    className="bg-orange/10 hover:bg-orange/20 border border-orange/20 text-orange text-xs font-semibold py-2 rounded-xl select-none">+{amt}</button>
                ))}
                <button type="button" onClick={() => setBillCashInputStr("")}
                  className="bg-sand/50 border border-sand text-gray-400 text-xs font-semibold py-2 rounded-xl select-none">ล้าง</button>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setBillGroupCash(null); setBillCashInputStr(""); resetDiscount(); }}
                  className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm font-semibold">ยกเลิก</button>
                <button onClick={confirmBillGroupCash} disabled={(finalTotal > 0 && (!billCashInputStr || received < finalTotal)) || billGroupCashLoading}
                  className="flex-1 bg-green-600 text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40">
                  {billGroupCashLoading ? "กำลังบันทึก..." : "✅ ชำระแล้ว"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bill group scan confirm modal */}
      {billGroupScan && (() => {
        const discAmt = calcDiscountAmount(billGroupScan.total);
        const finalTotal = billGroupScan.total - discAmt;
        return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-4">
            <h3 className="font-bold text-navy text-lg text-center">📷 ยืนยันการสแกน</h3>
            <p className="text-sm text-center text-gray-500">ตี้ {billGroupScan.billName} · {billGroupScan.orders.length} ออเดอร์</p>

            {/* Discount section */}
            <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500">ส่วนลด (ถ้ามี)</p>
              <div className="flex gap-1.5">
                <button type="button"
                  onClick={() => setDiscount((d) => ({ ...d, type: "PERCENT" }))}
                  className={`flex-1 py-1.5 rounded-xl text-sm font-bold border transition-colors ${discount.type === "PERCENT" ? "bg-orange text-white border-orange" : "bg-white border-sand text-gray-400"}`}>
                  %
                </button>
                <button type="button"
                  onClick={() => setDiscount((d) => ({ ...d, type: "FIXED" }))}
                  className={`flex-1 py-1.5 rounded-xl text-sm font-bold border transition-colors ${discount.type === "FIXED" ? "bg-orange text-white border-orange" : "bg-white border-sand text-gray-400"}`}>
                  ฿
                </button>
                <input
                  type="number"
                  min={0}
                  placeholder={discount.type === "PERCENT" ? "0–100" : "0"}
                  value={discount.value}
                  onChange={(e) => setDiscount((d) => ({ ...d, value: e.target.value }))}
                  className="w-24 border border-sand rounded-xl px-2 py-1.5 text-sm text-center text-navy font-bold bg-white"
                />
              </div>
              <input
                type="text"
                placeholder="หมายเหตุ เช่น สมาชิก, นักเรียน"
                value={discount.note}
                onChange={(e) => setDiscount((d) => ({ ...d, note: e.target.value }))}
                className="w-full border border-sand rounded-xl px-3 py-1.5 text-xs text-gray-600 bg-white"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              {discAmt > 0 ? (
                <div className="space-y-0.5">
                  <p className="text-xs text-blue-400 line-through">฿{billGroupScan.total.toLocaleString()}</p>
                  <p className="text-xs text-green-600">ส่วนลด −฿{discAmt.toLocaleString()}</p>
                  <p className="text-3xl font-black text-blue-700">฿{finalTotal.toLocaleString()}</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-blue-600 mb-1">ยอดรวมที่ต้องชำระ</p>
                  <p className="text-3xl font-black text-blue-700">฿{billGroupScan.total.toLocaleString()}</p>
                </>
              )}
            </div>
            <p className="text-xs text-center text-gray-400">ยืนยันว่าลูกค้าโอนเงินครบถ้วนแล้ว</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setBillGroupScan(null); resetDiscount(); }}
                disabled={billScanLoading}
                className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm font-semibold"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmBillGroupScan}
                disabled={billScanLoading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40"
              >
                {billScanLoading ? "กำลังบันทึก..." : "✅ ยืนยันชำระแล้ว"}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Split payment modal */}
      {billGroupSplit && (() => {
        const discAmt = calcDiscountAmount(billGroupSplit.total);
        const finalTotal = billGroupSplit.total - discAmt;
        const { step } = billGroupSplit;

        // --- Step: cash-portion ---
        if (step === "cash-portion") {
          const cashAmount = parseInt(splitCashStr.replace(/,/g, ""), 10) || 0;
          const scanRemaining = finalTotal - cashAmount;
          const canProceed = cashAmount > 0 && cashAmount < finalTotal;
          function pressCashDigit(d: string) { setSplitCashStr((p) => (p === "" || p === "0") ? d : p + d); }
          function pressCashBack() { setSplitCashStr((p) => p.slice(0, -1)); }
          return (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl space-y-3 my-4">
                <h3 className="font-bold text-navy text-lg text-center">💵📷 แบ่งจ่าย — ตี้ {billGroupSplit.billName}</h3>
                <p className="text-xs text-center text-gray-400">{billGroupSplit.orders.length} ออเดอร์รวมกัน</p>

                {/* Discount */}
                <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500">ส่วนลด (ถ้ามี)</p>
                  <div className="flex gap-1.5">
                    <button type="button"
                      onClick={() => setDiscount((d) => ({ ...d, type: "PERCENT" }))}
                      className={`flex-1 py-1.5 rounded-xl text-sm font-bold border transition-colors ${discount.type === "PERCENT" ? "bg-orange text-white border-orange" : "bg-white border-sand text-gray-400"}`}>
                      %
                    </button>
                    <button type="button"
                      onClick={() => setDiscount((d) => ({ ...d, type: "FIXED" }))}
                      className={`flex-1 py-1.5 rounded-xl text-sm font-bold border transition-colors ${discount.type === "FIXED" ? "bg-orange text-white border-orange" : "bg-white border-sand text-gray-400"}`}>
                      ฿
                    </button>
                    <input type="number" min={0} placeholder={discount.type === "PERCENT" ? "0–100" : "0"}
                      value={discount.value}
                      onChange={(e) => setDiscount((d) => ({ ...d, value: e.target.value }))}
                      className="w-24 border border-sand rounded-xl px-2 py-1.5 text-sm text-center text-navy font-bold bg-white" />
                  </div>
                  <input type="text" placeholder="หมายเหตุ เช่น สมาชิก, นักเรียน"
                    value={discount.note}
                    onChange={(e) => setDiscount((d) => ({ ...d, note: e.target.value }))}
                    className="w-full border border-sand rounded-xl px-3 py-1.5 text-xs text-gray-600 bg-white" />
                  <div className="text-center pt-1">
                    {discAmt > 0 ? (
                      <div className="space-y-0.5">
                        <p className="text-xs text-gray-400 line-through">฿{billGroupSplit.total.toLocaleString()}</p>
                        <p className="text-xs text-green-600">ส่วนลด −฿{discAmt.toLocaleString()}</p>
                        <p className="text-xl font-bold text-navy">รวม ฿{finalTotal.toLocaleString()}</p>
                      </div>
                    ) : (
                      <p className="text-xl font-bold text-navy">รวม ฿{finalTotal.toLocaleString()}</p>
                    )}
                  </div>
                </div>

                {/* Step label */}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="bg-violet-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs">1</span>
                  ระบุยอดที่ลูกค้าจ่ายด้วยเงินสด
                </div>

                {/* Cash amount display */}
                <div className="w-full border-2 border-sand rounded-xl px-4 py-3 text-2xl font-bold text-navy text-center bg-gray-50 min-h-[56px]">
                  {splitCashStr ? `฿${cashAmount.toLocaleString()}` : <span className="text-gray-300">฿0</span>}
                </div>

                {/* Remaining preview */}
                {cashAmount > 0 && cashAmount < finalTotal && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-center">
                    <p className="text-xs text-blue-500">ยอดที่ต้องสแกนเพิ่ม</p>
                    <p className="text-xl font-bold text-blue-700">฿{scanRemaining.toLocaleString()}</p>
                  </div>
                )}
                {cashAmount >= finalTotal && finalTotal > 0 && (
                  <p className="text-xs text-red-500 text-center">ยอดเกินทั้งหมด — ใช้ปุ่มเงินสดแทน</p>
                )}

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-1.5">
                  {["1","2","3","4","5","6","7","8","9"].map((d) => (
                    <button key={d} type="button" onClick={() => pressCashDigit(d)}
                      className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">{d}</button>
                  ))}
                  <button type="button" onClick={() => setSplitCashStr((p) => p === "" ? "" : p + "00")}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">00</button>
                  <button type="button" onClick={() => pressCashDigit("0")}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">0</button>
                  <button type="button" onClick={pressCashBack}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">⌫</button>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[20, 50, 100, 500, 1000].map((amt) => (
                    <button key={amt} type="button" onClick={() => setSplitCashStr(String((parseInt(splitCashStr) || 0) + amt))}
                      className="bg-orange/10 hover:bg-orange/20 border border-orange/20 text-orange text-xs font-semibold py-2 rounded-xl select-none">+{amt}</button>
                  ))}
                  <button type="button" onClick={() => setSplitCashStr("")}
                    className="bg-sand/50 border border-sand text-gray-400 text-xs font-semibold py-2 rounded-xl select-none">ล้าง</button>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setBillGroupSplit(null); setSplitCashStr(""); setSplitReceivedStr(""); resetDiscount(); }}
                    className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm font-semibold">ยกเลิก</button>
                  <button
                    disabled={!canProceed}
                    onClick={() => setBillGroupSplit((s) => s ? { ...s, step: "cash-received", cashPaid: cashAmount } : s)}
                    className="flex-1 bg-violet-600 text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40">
                    ถัดไป →
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // --- Step: cash-received (calculate change) ---
        if (step === "cash-received") {
          const { cashPaid } = billGroupSplit;
          const received = parseInt(splitReceivedStr.replace(/,/g, ""), 10) || 0;
          const change = received - cashPaid;
          function pressRecDigit(d: string) { setSplitReceivedStr((p) => (p === "" || p === "0") ? d : p + d); }
          function pressRecBack() { setSplitReceivedStr((p) => p.slice(0, -1)); }
          return (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl space-y-3 my-4">
                <h3 className="font-bold text-navy text-lg text-center">💵📷 แบ่งจ่าย — ตี้ {billGroupSplit.billName}</h3>

                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-600">ยอดเงินสด</p>
                  <p className="text-2xl font-bold text-green-700">฿{cashPaid.toLocaleString()}</p>
                  <p className="text-xs text-blue-500 mt-1">ยอดที่ต้องสแกนเพิ่ม ฿{(finalTotal - cashPaid).toLocaleString()}</p>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="bg-violet-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs">1</span>
                  ระบุเงินที่รับมาจากลูกค้า (เงินสด)
                </div>

                <div className="w-full border-2 border-sand rounded-xl px-4 py-3 text-2xl font-bold text-navy text-center bg-gray-50 min-h-[56px]">
                  {splitReceivedStr ? `฿${received.toLocaleString()}` : <span className="text-gray-300">฿0</span>}
                </div>
                {splitReceivedStr && (
                  <div className={`rounded-xl p-2.5 text-center ${received >= cashPaid ? "bg-green-50" : "bg-red-50"}`}>
                    {received >= cashPaid
                      ? <><p className="text-xs text-green-600">เงินทอน</p><p className="text-2xl font-bold text-green-700">฿{change.toLocaleString()}</p></>
                      : <p className="text-sm font-semibold text-red-500">ขาดอีก ฿{(cashPaid - received).toLocaleString()}</p>}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5">
                  {["1","2","3","4","5","6","7","8","9"].map((d) => (
                    <button key={d} type="button" onClick={() => pressRecDigit(d)}
                      className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">{d}</button>
                  ))}
                  <button type="button" onClick={() => setSplitReceivedStr((p) => p === "" ? "" : p + "00")}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">00</button>
                  <button type="button" onClick={() => pressRecDigit("0")}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">0</button>
                  <button type="button" onClick={pressRecBack}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">⌫</button>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[20, 50, 100, 500, 1000].map((amt) => (
                    <button key={amt} type="button" onClick={() => setSplitReceivedStr(String((parseInt(splitReceivedStr) || 0) + amt))}
                      className="bg-orange/10 hover:bg-orange/20 border border-orange/20 text-orange text-xs font-semibold py-2 rounded-xl select-none">+{amt}</button>
                  ))}
                  <button type="button" onClick={() => setSplitReceivedStr("")}
                    className="bg-sand/50 border border-sand text-gray-400 text-xs font-semibold py-2 rounded-xl select-none">ล้าง</button>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setBillGroupSplit((s) => s ? { ...s, step: "cash-portion" } : s); setSplitReceivedStr(""); }}
                    className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm font-semibold">← กลับ</button>
                  <button
                    disabled={!splitReceivedStr || received < cashPaid}
                    onClick={() => setBillGroupSplit((s) => s ? { ...s, step: "scan" } : s)}
                    className="flex-1 bg-violet-600 text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40">
                    ยืนยันรับเงินสด →
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // --- Step: scan ---
        const scanAmount = finalTotal - billGroupSplit.cashPaid;
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-4">
              <h3 className="font-bold text-navy text-lg text-center">💵📷 แบ่งจ่าย — ตี้ {billGroupSplit.billName}</h3>

              <div className="flex gap-2">
                <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-600">รับเงินสดแล้ว</p>
                  <p className="text-xl font-bold text-green-700">฿{billGroupSplit.cashPaid.toLocaleString()}</p>
                </div>
                <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-600">คงเหลือ (สแกน)</p>
                  <p className="text-xl font-bold text-blue-700">฿{scanAmount.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="bg-violet-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs">2</span>
                ให้ลูกค้าสแกนจ่ายยอดที่เหลือ แล้วกดยืนยัน
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-xs text-blue-600 mb-1">ยอดที่ต้องสแกน</p>
                <p className="text-3xl font-black text-blue-700">฿{scanAmount.toLocaleString()}</p>
              </div>
              <p className="text-xs text-center text-gray-400">ยืนยันว่าลูกค้าโอนเงินครบถ้วนแล้ว</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setBillGroupSplit(null); setSplitCashStr(""); setSplitReceivedStr(""); resetDiscount(); }}
                  disabled={splitLoading}
                  className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm font-semibold">
                  ยกเลิก
                </button>
                <button
                  onClick={confirmBillGroupSplit}
                  disabled={splitLoading}
                  className="flex-1 bg-violet-600 text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40">
                  {splitLoading ? "กำลังบันทึก..." : "✅ ยืนยันชำระครบแล้ว"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Single-order split payment modal */}
      {orderSplit && (() => {
        const total = orderSplit.order.totalTHB;
        const { step } = orderSplit;

        if (step === "cash-portion") {
          const cashAmt = parseInt(orderSplitCashStr.replace(/,/g, ""), 10) || 0;
          const canProceed = cashAmt > 0 && cashAmt < total;
          function pressCashD(d: string) { setOrderSplitCashStr((p) => (p === "" || p === "0") ? d : p + d); }
          return (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl space-y-3 my-4">
                <h3 className="font-bold text-navy text-lg text-center">💵📷 แบ่งจ่าย</h3>
                <p className="text-xl font-bold text-orange text-center">ยอดรวม ฿{total.toLocaleString()}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="bg-violet-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs">1</span>
                  ระบุยอดที่ลูกค้าจ่ายด้วยเงินสด
                </div>
                <div className="w-full border-2 border-sand rounded-xl px-4 py-3 text-2xl font-bold text-navy text-center bg-gray-50 min-h-[56px]">
                  {orderSplitCashStr ? `฿${cashAmt.toLocaleString()}` : <span className="text-gray-300">฿0</span>}
                </div>
                {cashAmt > 0 && cashAmt < total && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-center">
                    <p className="text-xs text-blue-500">ยอดที่ต้องสแกนเพิ่ม</p>
                    <p className="text-xl font-bold text-blue-700">฿{(total - cashAmt).toLocaleString()}</p>
                  </div>
                )}
                {cashAmt >= total && total > 0 && (
                  <p className="text-xs text-red-500 text-center">ยอดเกินทั้งหมด — ใช้ปุ่มเงินสดแทน</p>
                )}
                <div className="grid grid-cols-3 gap-1.5">
                  {["1","2","3","4","5","6","7","8","9"].map((d) => (
                    <button key={d} type="button" onClick={() => pressCashD(d)}
                      className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">{d}</button>
                  ))}
                  <button type="button" onClick={() => setOrderSplitCashStr((p) => p === "" ? "" : p + "00")}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">00</button>
                  <button type="button" onClick={() => pressCashD("0")}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">0</button>
                  <button type="button" onClick={() => setOrderSplitCashStr((p) => p.slice(0, -1))}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">⌫</button>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[20, 50, 100, 500, 1000].map((amt) => (
                    <button key={amt} type="button" onClick={() => setOrderSplitCashStr(String((parseInt(orderSplitCashStr) || 0) + amt))}
                      className="bg-orange/10 hover:bg-orange/20 border border-orange/20 text-orange text-xs font-semibold py-2 rounded-xl select-none">+{amt}</button>
                  ))}
                  <button type="button" onClick={() => setOrderSplitCashStr("")}
                    className="bg-sand/50 border border-sand text-gray-400 text-xs font-semibold py-2 rounded-xl select-none">ล้าง</button>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setOrderSplit(null); setOrderSplitCashStr(""); setOrderSplitReceivedStr(""); }}
                    className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm font-semibold">ยกเลิก</button>
                  <button disabled={!canProceed}
                    onClick={() => setOrderSplit((s) => s ? { ...s, step: "cash-received", cashPaid: cashAmt } : s)}
                    className="flex-1 bg-violet-600 text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40">ถัดไป →</button>
                </div>
              </div>
            </div>
          );
        }

        if (step === "cash-received") {
          const { cashPaid } = orderSplit;
          const received = parseInt(orderSplitReceivedStr.replace(/,/g, ""), 10) || 0;
          const change = received - cashPaid;
          function pressRecD(d: string) { setOrderSplitReceivedStr((p) => (p === "" || p === "0") ? d : p + d); }
          return (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl space-y-3 my-4">
                <h3 className="font-bold text-navy text-lg text-center">💵📷 แบ่งจ่าย</h3>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-600">ยอดเงินสด</p>
                  <p className="text-2xl font-bold text-green-700">฿{cashPaid.toLocaleString()}</p>
                  <p className="text-xs text-blue-500 mt-1">ยอดที่ต้องสแกนเพิ่ม ฿{(total - cashPaid).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="bg-violet-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs">1</span>
                  ระบุเงินที่รับมาจากลูกค้า (เงินสด)
                </div>
                <div className="w-full border-2 border-sand rounded-xl px-4 py-3 text-2xl font-bold text-navy text-center bg-gray-50 min-h-[56px]">
                  {orderSplitReceivedStr ? `฿${received.toLocaleString()}` : <span className="text-gray-300">฿0</span>}
                </div>
                {orderSplitReceivedStr && (
                  <div className={`rounded-xl p-2.5 text-center ${received >= cashPaid ? "bg-green-50" : "bg-red-50"}`}>
                    {received >= cashPaid
                      ? <><p className="text-xs text-green-600">เงินทอน</p><p className="text-2xl font-bold text-green-700">฿{change.toLocaleString()}</p></>
                      : <p className="text-sm font-semibold text-red-500">ขาดอีก ฿{(cashPaid - received).toLocaleString()}</p>}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-1.5">
                  {["1","2","3","4","5","6","7","8","9"].map((d) => (
                    <button key={d} type="button" onClick={() => pressRecD(d)}
                      className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">{d}</button>
                  ))}
                  <button type="button" onClick={() => setOrderSplitReceivedStr((p) => p === "" ? "" : p + "00")}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">00</button>
                  <button type="button" onClick={() => pressRecD("0")}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">0</button>
                  <button type="button" onClick={() => setOrderSplitReceivedStr((p) => p.slice(0, -1))}
                    className="bg-gray-50 hover:bg-sand active:scale-95 border border-sand text-navy font-bold text-xl py-3.5 rounded-xl transition-transform select-none">⌫</button>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[20, 50, 100, 500, 1000].map((amt) => (
                    <button key={amt} type="button" onClick={() => setOrderSplitReceivedStr(String((parseInt(orderSplitReceivedStr) || 0) + amt))}
                      className="bg-orange/10 hover:bg-orange/20 border border-orange/20 text-orange text-xs font-semibold py-2 rounded-xl select-none">+{amt}</button>
                  ))}
                  <button type="button" onClick={() => setOrderSplitReceivedStr("")}
                    className="bg-sand/50 border border-sand text-gray-400 text-xs font-semibold py-2 rounded-xl select-none">ล้าง</button>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setOrderSplit((s) => s ? { ...s, step: "cash-portion" } : s); setOrderSplitReceivedStr(""); }}
                    className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm font-semibold">← กลับ</button>
                  <button disabled={!orderSplitReceivedStr || received < cashPaid}
                    onClick={() => setOrderSplit((s) => s ? { ...s, step: "scan" } : s)}
                    className="flex-1 bg-violet-600 text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40">ยืนยันรับเงินสด →</button>
                </div>
              </div>
            </div>
          );
        }

        // step === "scan"
        const scanAmt = total - orderSplit.cashPaid;
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-4">
              <h3 className="font-bold text-navy text-lg text-center">💵📷 แบ่งจ่าย</h3>
              <div className="flex gap-2">
                <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-600">รับเงินสดแล้ว</p>
                  <p className="text-xl font-bold text-green-700">฿{orderSplit.cashPaid.toLocaleString()}</p>
                </div>
                <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-600">คงเหลือ (สแกน)</p>
                  <p className="text-xl font-bold text-blue-700">฿{scanAmt.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="bg-violet-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs">2</span>
                ให้ลูกค้าสแกนจ่ายยอดที่เหลือ แล้วกดยืนยัน
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-xs text-blue-600 mb-1">ยอดที่ต้องสแกน</p>
                <p className="text-3xl font-black text-blue-700">฿{scanAmt.toLocaleString()}</p>
              </div>
              <p className="text-xs text-center text-gray-400">ยืนยันแล้วระบบจะสร้าง QR สำหรับสแกน</p>
              <div className="flex gap-2">
                <button onClick={() => { setOrderSplit(null); setOrderSplitCashStr(""); setOrderSplitReceivedStr(""); }}
                  className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm font-semibold">ยกเลิก</button>
                <button
                  onClick={() => {
                    const o = orderSplit.order;
                    setOrderSplit(null);
                    setOrderSplitCashStr("");
                    setOrderSplitReceivedStr("");
                    chooseScan(o);
                  }}
                  className="flex-1 bg-violet-600 text-white py-3 rounded-2xl text-sm font-bold">
                  📷 ไปสแกน
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Discount preset picker modal */}
      {discountModal && (() => {
        const n = Number(discountPickValue);
        const previewAmt = n > 0
          ? discountPickType === "PERCENT"
            ? Math.round(discountModal.total * Math.min(n, 100) / 100)
            : Math.min(n, discountModal.total)
          : 0;
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl space-y-4">
              <h3 className="font-bold text-navy text-lg text-center">💸 ส่วนลด — ตี้ {discountModal.billName}</h3>

              {/* Presets */}
              {discountPresets.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">เลือก preset</p>
                  <div className="flex flex-wrap gap-2">
                    {discountPresets.map((p) => (
                      <button key={p.id}
                        onClick={() => { setDiscountPickType(p.type as "PERCENT" | "FIXED"); setDiscountPickValue(String(p.value)); setDiscountPickNote(p.nameTh); }}
                        className={`text-sm font-semibold px-3 py-1.5 rounded-xl border transition-colors ${discountPickValue === String(p.value) && discountPickNote === p.nameTh ? "bg-orange text-white border-orange" : "bg-orange/10 text-orange border-orange/30"}`}>
                        {p.nameTh} ({p.type === "PERCENT" ? `${p.value}%` : `฿${p.value}`})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom input */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">หรือใส่เอง</p>
                <div className="flex gap-1.5">
                  <div className="flex rounded-xl border border-sand overflow-hidden shrink-0">
                    <button onClick={() => setDiscountPickType("FIXED")}
                      className={`px-4 py-2 text-sm font-bold transition-colors ${discountPickType === "FIXED" ? "bg-orange text-white" : "bg-white text-gray-400"}`}>฿</button>
                    <button onClick={() => setDiscountPickType("PERCENT")}
                      className={`px-4 py-2 text-sm font-bold transition-colors ${discountPickType === "PERCENT" ? "bg-orange text-white" : "bg-white text-gray-400"}`}>%</button>
                  </div>
                  <input type="number" min={0}
                    placeholder={discountPickType === "PERCENT" ? "0–100" : "0"}
                    value={discountPickValue}
                    onChange={(e) => setDiscountPickValue(e.target.value)}
                    className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm text-center text-navy font-bold" />
                </div>
                <input type="text" placeholder="หมายเหตุ เช่น สมาชิก, นักเรียน"
                  value={discountPickNote}
                  onChange={(e) => setDiscountPickNote(e.target.value)}
                  className="w-full border border-sand rounded-xl px-3 py-1.5 text-xs text-gray-600" />
              </div>

              {/* Preview */}
              <div className="bg-green-50 rounded-xl p-3 text-center space-y-0.5">
                {previewAmt > 0 ? (
                  <>
                    <p className="text-xs text-gray-400 line-through">฿{discountModal.total.toLocaleString()}</p>
                    <p className="text-sm text-green-600 font-semibold">− ฿{previewAmt.toLocaleString()}</p>
                    <p className="text-xl font-black text-navy">฿{(discountModal.total - previewAmt).toLocaleString()}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">ยอดรวม</p>
                    <p className="text-xl font-black text-navy">฿{discountModal.total.toLocaleString()}</p>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setDiscountModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium">ยกเลิก</button>
                {discountModal.currentAmount != null && (
                  <button onClick={async () => { if (discountModal.billId != null) await removeBillDiscount(discountModal.billId); else if (discountModal.orderId != null) removeOrderDiscount(discountModal.orderId); setDiscountModal(null); }}
                    className="px-4 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-medium">ลบส่วนลด</button>
                )}
                <button onClick={applyBillDiscount} disabled={!discountPickValue || Number(discountPickValue) <= 0 || discountSaving}
                  className="flex-1 py-2.5 rounded-xl bg-orange text-white font-bold text-sm disabled:opacity-50">
                  {discountSaving ? "..." : "✅ ตั้งค่า"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-sm p-6">
            <p className="font-bold text-navy text-lg mb-1">{confirmAction.message}</p>
            {confirmAction.detail && (
              <p className="text-sm text-gray-500 mb-2">{confirmAction.detail}</p>
            )}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  setConfirmAction(null);
                  confirmAction.onConfirm();
                }}
                className={`flex-1 py-3 rounded-xl font-bold text-sm ${confirmAction.confirmColor}`}
              >
                {confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-start justify-between shrink-0">
              <div>
                <h3 className="font-bold text-navy text-lg">✏️ แก้ไขออเดอร์ #{editOrder.id}</h3>
                <p className="text-sm text-gray-500">👤 {editOrder.orderName}</p>
              </div>
              <button
                onClick={() => setEditOrder(null)}
                className="text-gray-400 text-2xl leading-none px-1"
              >
                ×
              </button>
            </div>

            {/* Items */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {editItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                    item.quantity === 0 ? "border-red-200 bg-red-50 opacity-50" : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.quantity === 0 ? "line-through text-gray-400" : "text-navy"}`}>
                      {item.nameTh}
                      {item.selectedSize && (
                        <span className="ml-1 text-xs bg-orange/10 text-orange px-1.5 py-0.5 rounded-full">
                          {item.selectedSize}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">฿{item.unitPrice} / ชิ้น</p>
                    {item.quantity === 0 && (
                      <p className="text-xs text-red-400 font-medium">จะถูกลบออก</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => changeQty(item.id, -1)}
                      className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-600 font-bold text-lg leading-none flex items-center justify-center shadow-sm"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-bold text-navy">{item.quantity}</span>
                    <button
                      onClick={() => changeQty(item.id, +1)}
                      className="w-8 h-8 rounded-full bg-orange text-white font-bold text-lg leading-none flex items-center justify-center shadow-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              {/* Note */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">📝 หมายเหตุ</label>
                <input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="หมายเหตุ..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/30"
                />
              </div>

              {/* Bill change */}
              {activeBills && activeBills.length > 0 && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">🪑 เปลี่ยนตี้ (กรณีลูกค้าลงโต๊ะผิด)</label>
                  <select
                    value={editBillId === undefined ? "__nochange__" : editBillId === null ? "__none__" : String(editBillId)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__nochange__") setEditBillId(undefined);
                      else if (v === "__none__") setEditBillId(null);
                      else setEditBillId(Number(v));
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/30 bg-white"
                  >
                    <option value="__nochange__">
                      {editOrder.bill ? `ตี้ ${editOrder.bill.name} · โต๊ะ ${editOrder.bill.table?.number} (ไม่เปลี่ยน)` : "ไม่ได้เชื่อมตี้ (ไม่เปลี่ยน)"}
                    </option>
                    {activeBills
                      .filter((b) => b.id !== editOrder.billId)
                      .map((b) => (
                        <option key={b.id} value={String(b.id)}>
                          ตี้ {b.name} · โต๊ะ {b.table.number}
                        </option>
                      ))}
                    {editOrder.billId && (
                      <option value="__none__">ยกเลิกการเชื่อมตี้</option>
                    )}
                  </select>
                  {editBillId !== undefined && editBillId !== null && (
                    <p className="text-xs text-orange mt-1">
                      จะย้ายออเดอร์ไปตี้ที่เลือก
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 shrink-0">
              <div className="flex justify-between font-bold text-navy mb-3">
                <span>รวมทั้งหมด</span>
                <span className="text-orange">฿{editTotal}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditOrder(null)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="flex-1 py-3 rounded-xl bg-navy text-white font-bold text-sm disabled:opacity-50"
                >
                  {savingEdit ? "กำลังบันทึก..." : "💾 บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slip lightbox */}
      {slipLightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          onClick={() => setSlipLightbox(null)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSlipLightbox(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-3xl leading-none"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slipLightbox}
              alt="สลิป"
              className="w-full max-h-[80vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BillOrderGroupCard({
  orders,
  servedAcked,
  onServeAck,
  isLoading,
  onOpenCashModal,
  onScanCheckout,
  onSplitCheckout,
  kitchenItemAcked,
  onAckKitchenItems,
  onPrintReceipt,
  onEdit,
  onCancelOrder,
  onSetDiscount,
  onRemoveDiscount,
  onPurgeBill,
}: {
  orders: OrderWithItems[];
  servedAcked: Set<number>;
  onServeAck: (id: number) => void;
  isLoading: boolean;
  onOpenCashModal: (orders: OrderWithItems[]) => void;
  onScanCheckout: (orders: OrderWithItems[]) => void;
  onSplitCheckout: (orders: OrderWithItems[]) => void;
  kitchenItemAcked: Set<number>;
  onAckKitchenItems: (itemIds: number[]) => void;
  onPrintReceipt: (orders: OrderWithItems[]) => void;
  onEdit: (order: OrderWithItems) => void;
  onCancelOrder: (id: number) => void;
  onSetDiscount: (orders: OrderWithItems[]) => void;
  onRemoveDiscount: (billId: number) => void;
  onPurgeBill: (billId: number) => void;
}) {
  const first = orders[0];
  const bill = first.bill;
  const bc = BILL_COLOR_MAP[bill?.color ?? "indigo"] ?? BILL_COLOR_MAP.indigo;
  const rawTotal = orders.reduce((s, o) => s + o.totalTHB, 0);
  const discountAmt = bill?.discountAmount ?? 0;
  const totalTHB = rawTotal - discountAmt;
  const allItems = orders.flatMap((o) => o.items.filter((i) => !i.cancelledAt));
  const kitchenDone = isKitchenDone(allItems);
  const allServedAcked = orders.every((o) => servedAcked.has(o.id));
  // Items in this bill that are kitchen-done but not yet acknowledged
  const unackedReadyItems = allItems.filter((i) => i.kitchenServedAt && !kitchenItemAcked.has(i.id));

  // Sort orders newest first within the group
  const sorted = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-transparent p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <span className={`inline-block font-black text-base px-3 py-0.5 rounded-full ${bc.bg} ${bc.text} mb-1`}>
            ตี้ {bill?.name}
          </span>
          <p className="text-xs text-gray-400">โต๊ะ {bill?.table.number} · {orders.length} ออเดอร์รวมกัน</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold px-2 py-1 rounded-full border bg-amber-100 text-amber-800 border-amber-300">
            🧾 รอชำระรวม
          </span>
        </div>
      </div>

      {/* All items from all orders */}
      <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-3">
        {sorted.map((order, oi) => (
          <div key={order.id}>
            {orders.length > 1 && (
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                  ออเดอร์ {oi + 1} · 👤 {order.orderName} · {formatThaiDateTime(order.createdAt)}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEdit(order)}
                    className="text-[10px] font-semibold text-gray-400 hover:text-navy border border-gray-200 rounded-lg px-1.5 py-0.5"
                  >
                    ✏️ แก้ไข
                  </button>
                  {(order.status === "PENDING" || order.status === "CONFIRMED") && (
                    <button
                      onClick={() => onCancelOrder(order.id)}
                      className="text-[10px] font-semibold text-red-400 hover:text-red-600 border border-red-100 rounded-lg px-1.5 py-0.5"
                    >
                      ❌ ยกเลิก
                    </button>
                  )}
                </div>
              </div>
            )}
            {order.items.map((item) => {
              const addons: { nameTh: string }[] = item.selectedAddons ? JSON.parse(item.selectedAddons) : [];
              const options: { groupName: string; choiceName: string }[] = item.selectedOptions ? JSON.parse(item.selectedOptions) : [];
              return (
                <div key={item.id} className="flex justify-between text-sm gap-2 py-0.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-gray-800 font-medium">{item.menuItem.nameTh}</span>
                      {item.selectedSize && <span className="text-xs bg-orange/10 text-orange px-1.5 py-0.5 rounded-full">{item.selectedSize}</span>}
                      <span className="text-gray-400">×{item.quantity}</span>
                      {item.menuItem.queueTarget !== "none" && (
                        item.kitchenServedAt
                          ? <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">✅ พร้อม</span>
                          : <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">🍳 กำลังทำ</span>
                      )}
                    </div>
                    {addons.length > 0 && <p className="text-xs text-gray-400">+ {addons.map((a) => a.nameTh).join(", ")}</p>}
                    {options.length > 0 && <p className="text-xs text-gray-400">{options.map((o) => `${o.groupName}: ${o.choiceName}`).join(", ")}</p>}
                  </div>
                  <span className="text-navy font-semibold shrink-0">฿{item.unitPriceTHB * item.quantity}</span>
                </div>
              );
            })}
            {order.note && (
              <p className="text-xs text-orange bg-orange/10 rounded-lg px-2 py-1 mt-1">📝 {order.note}</p>
            )}
          </div>
        ))}
        {discountAmt > 0 && (
          <div className="flex justify-between items-center text-sm text-green-600 font-semibold pt-1">
            <span className="flex items-center gap-1">
              💸 {bill?.discountNote || "ส่วนลด"}
              <button onClick={() => onRemoveDiscount(bill!.id)} className="text-xs text-red-400 hover:text-red-600 ml-1">✕</button>
            </span>
            <span>− ฿{discountAmt.toLocaleString()}</span>
          </div>
        )}
        <div className="border-t border-gray-200 pt-1.5 flex justify-between font-black text-navy text-base">
          <span>รวมทั้งหมด</span>
          <span>฿{totalTHB.toLocaleString()}</span>
        </div>
      </div>

      {/* Discount button */}
      <button
        onClick={() => onSetDiscount(orders)}
        disabled={isLoading}
        className={`w-full flex items-center justify-center gap-2 font-semibold py-2 rounded-xl text-sm mb-2 border transition-colors disabled:opacity-40 ${
          discountAmt > 0
            ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            : "bg-orange/10 border-orange/20 text-orange hover:bg-orange/20"
        }`}
      >
        💸 {discountAmt > 0 ? `ส่วนลด ฿${discountAmt.toLocaleString()} — แก้ไข` : "เพิ่มส่วนลด"}
      </button>

      {/* Per-item kitchen-done acknowledgment — dismiss alert as items complete */}
      {unackedReadyItems.length > 0 && (
        <div className="mb-2">
          <button
            onClick={() => onAckKitchenItems(unackedReadyItems.map((i) => i.id))}
            className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 text-navy font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            🔔 รับทราบ ({unackedReadyItems.length} เมนูพร้อม) — หยุดเสียงแจ้งเตือน
          </button>
        </div>
      )}

      {/* Confirm serve — required for all bill groups */}
      <div className="mb-2">
        {!allServedAcked ? (
          <button
            onClick={() => orders.forEach((o) => onServeAck(o.id))}
            className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl text-sm transition-colors ${
              kitchenDone
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300"
            }`}
          >
            🍽️ {kitchenDone ? "ยืนยันการเสิร์ฟ (ครบทุกเมนูแล้ว)" : "ยืนยันการเสิร์ฟ"}
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-xl py-2.5 text-sm text-green-700 font-semibold">
            ✅ เสิร์ฟถึงโต๊ะแล้ว
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onOpenCashModal(orders)}
          disabled={isLoading}
          className="flex flex-col items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors"
        >
          <span className="text-xl">💵</span>
          {isLoading ? "..." : "เงินสด"}
        </button>
        <button
          onClick={() => onScanCheckout(orders)}
          disabled={isLoading}
          className="flex flex-col items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors"
        >
          <span className="text-xl">📷</span>
          {isLoading ? "..." : "สแกน"}
        </button>
      </div>
      <button
        onClick={() => onSplitCheckout(orders)}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60 transition-colors"
      >
        <span>💵📷</span>
        {isLoading ? "..." : "แบ่งจ่าย (เงินสด + สแกน)"}
      </button>

      {/* Print receipt */}
      <button
        onClick={() => onPrintReceipt(orders)}
        className="mt-2 w-full flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm transition-colors"
      >
        🖨️ พิมพ์ใบเสร็จรวมบิล
      </button>

      {/* Secondary actions — edit + cancel (single-order bill groups only) */}
      {orders.length === 1 && (orders[0].status === "PENDING" || orders[0].status === "CONFIRMED") && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onEdit(orders[0])}
            disabled={isLoading}
            className="flex-1 bg-gray-50 text-gray-600 border border-gray-200 text-sm font-medium py-2 rounded-xl disabled:opacity-40"
          >
            ✏️ แก้ไข
          </button>
          <button
            onClick={() => onCancelOrder(orders[0].id)}
            disabled={isLoading}
            className="flex-1 bg-red-50 text-red-600 text-sm font-medium py-2 rounded-xl disabled:opacity-40"
          >
            ❌ ยกเลิก
          </button>
        </div>
      )}
      {/* Purge bill — test only */}
      {first.billId && (
        <button
          onClick={() => onPurgeBill(first.billId!)}
          disabled={isLoading}
          className="mt-1 w-full flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-400 hover:text-red-700 text-xs font-medium py-2 rounded-xl disabled:opacity-40 transition-colors"
          title="ทำลายบิลทั้งหมด (สำหรับทดสอบ)"
        >
          ⛔ ทำลายบิลนี้ออกจากระบบ
        </button>
      )}
    </div>
  );
}

function OrderCard({
  order,
  isNew,
  isLoading,
  onUpdate,
  onEdit,
  onDelete,
  onPurge,
  onPrint,
  onSplitOrder,
  onKitchen,
  kitchenEnabled,
  onOpenCashModal,
  onConfirmQr,
  onChooseScan,
  onResetPayment,
  qrUrl,
  servedAcked,
  onServeAck,
  kitchenItemAcked,
  onAckKitchenItems,
  onOpenSlip,
  onSetOrderDiscount,
  onRemoveOrderDiscount,
  orderDiscountAmount,
}: {
  order: OrderWithItems;
  isNew: boolean;
  isLoading: boolean;
  onUpdate: (id: number, status: string) => void;
  onEdit: (order: OrderWithItems) => void;
  onDelete: (id: number) => void;
  onPurge: (id: number, billId?: number | null) => void;
  onPrint: (order: OrderWithItems) => void;
  onSplitOrder: (order: OrderWithItems) => void;
  onKitchen: (order: OrderWithItems) => void;
  kitchenEnabled: boolean;
  onOpenCashModal: (order: OrderWithItems) => void;
  onConfirmQr: (order: OrderWithItems) => void;
  onChooseScan: (order: OrderWithItems) => void;
  onResetPayment: (order: OrderWithItems) => void;
  qrUrl?: string;
  servedAcked: Set<number>;
  onServeAck: (id: number) => void;
  kitchenItemAcked: Set<number>;
  onAckKitchenItems: (itemIds: number[]) => void;
  onOpenSlip: (url: string) => void;
  onSetOrderDiscount?: (order: OrderWithItems) => void;
  onRemoveOrderDiscount?: (orderId: number) => void;
  orderDiscountAmount?: number;
}) {
  const badge = resolveStatusBadge(order);
  const cfg = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING;
  const canCancel = order.status === "PENDING" || order.status === "CONFIRMED";
  const canEdit = order.status === "PENDING" || order.status === "CONFIRMED" || order.status === "PAID";

  const isConfirmed = order.status === "CONFIRMED";
  const isPending = order.status === "PENDING";
  const method = order.payment?.method;
  const hasSlip = !!order.payment?.slipUrl;
  const activeItems = order.items.filter((i) => !i.cancelledAt);
  const kitchenDone = isKitchenDone(order.items);

  // PENDING payment cases (customer already selected method)
  const isPendingCash = isPending && method === "CASH";
  const isPendingQrNoSlip = isPending && method === "PROMPTPAY" && !hasSlip;
  const isPendingQrSlip = isPending && method === "PROMPTPAY" && hasSlip;
  const isPendingTab = isPending && method === "TAB";

  // CONFIRMED payment cases
  const needsMethod = isConfirmed && (!order.payment || method === "UNSET");
  const isCashPay = isConfirmed && method === "CASH";
  const isQrSlip = isConfirmed && method === "PROMPTPAY" && hasSlip;
  const isQrNoSlip = isConfirmed && method === "PROMPTPAY" && !hasSlip;
  // TAB order linked to a bill → pays via bill checkout, NOT per-order buttons
  const isTabOrder = method === "TAB" && isConfirmed && !order.billId;
  const isBillTab = method === "TAB" && isConfirmed && !!order.billId;

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
        isNew ? "border-yellow-400 shadow-yellow-100 shadow-lg" : "border-transparent"
      }`}
    >
      {isNew && (
        <div className={`text-xs font-bold text-center py-1 rounded-t-xl animate-pulse ${
          isPendingCash ? "bg-indigo-500 text-white" :
          isPendingQrNoSlip ? "bg-blue-500 text-white" :
          isPendingQrSlip ? "bg-teal-500 text-white" :
          isPendingTab ? "bg-amber-500 text-white" :
          "bg-yellow-400 text-white"
        }`}>
          {isPendingCash ? "🏪 ลูกค้าเลือกชำระที่เคาน์เตอร์" :
           isPendingQrNoSlip ? "📷 รอสลิปจากลูกค้า" :
           isPendingQrSlip ? "📨 ลูกค้าส่งสลิปแล้ว!" :
           isPendingTab ? "🧾 ลูกค้าเลือกจ่ายตอนเช็กเอาท์" :
           "🔔 ออเดอร์ใหม่!"}
        </div>
      )}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-2">
            {/* Bill name — most prominent, colored by bill color */}
            {order.bill && (() => {
              const c = BILL_COLOR_MAP[order.bill.color] ?? BILL_COLOR_MAP.indigo;
              return (
                <span className={`inline-block font-black text-base px-3 py-0.5 rounded-full ${c.bg} ${c.text} mb-1`}>
                  ตี้ {order.bill.name}
                </span>
              );
            })()}
            {/* Table number — smaller, below bill name */}
            {order.bill ? (
              <p className="text-xs text-gray-400 mb-0.5">โต๊ะ {order.bill.table.number}</p>
            ) : order.tableId ? (
              <p className="font-bold text-navy text-lg">โต๊ะ {order.tableId}</p>
            ) : null}
            <p className="text-sm text-gray-500">👤 {order.orderName || `ออเดอร์ #${order.id}`}</p>
            <p className="text-xs text-gray-400">{formatThaiDateTime(order.createdAt)}</p>
            {isPendingCash && (
              <div className="mt-1 inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-0.5">
                <span className="text-xs text-indigo-500">เลขที่ออเดอร์</span>
                <span className="font-black text-indigo-700">#{order.id}</span>
              </div>
            )}
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full border shrink-0 ${badge.color}`}>
            {badge.label}
          </span>
        </div>

        {/* Items */}
        <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-2">
          {order.items.filter((item) => !item.cancelledAt).map((item) => {
            const addons: { nameTh: string }[] = item.selectedAddons
              ? JSON.parse(item.selectedAddons)
              : [];
            const options: { groupName: string; choiceName: string }[] = item.selectedOptions
              ? JSON.parse(item.selectedOptions)
              : [];
            const inKitchen = !order.kitchenServedAt && (order.status === "CONFIRMED" || order.status === "PAID");
            return (
              <div key={item.id} className="flex justify-between text-sm gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-gray-800 font-medium">{item.menuItem.nameTh}</span>
                    {item.selectedSize && (
                      <span className="text-xs bg-orange/10 text-orange px-1.5 py-0.5 rounded-full">
                        {item.selectedSize}
                      </span>
                    )}
                    <span className="text-gray-400 font-normal">×{item.quantity}</span>
                    {item.menuItem.queueTarget !== "none" && inKitchen && !item.kitchenServedAt && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                        🍳 กำลังทำ
                      </span>
                    )}
                    {item.menuItem.queueTarget !== "none" && item.kitchenServedAt && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                        ✅ พร้อม
                      </span>
                    )}
                  </div>
                  {addons.length > 0 && (
                    <p className="text-xs text-gray-400">+ {addons.map((a) => a.nameTh).join(", ")}</p>
                  )}
                  {options.length > 0 && (
                    <p className="text-xs text-gray-400">
                      {options.map((o) => `${o.groupName}: ${o.choiceName}`).join(", ")}
                    </p>
                  )}
                </div>
                <span className="text-navy font-semibold shrink-0">
                  ฿{item.unitPriceTHB * item.quantity}
                </span>
              </div>
            );
          })}
          {order.items.some((i) => i.cancelledAt) && (
            <p className="text-xs text-red-400 border-t border-red-100 pt-1.5">
              ❌ {order.items.filter((i) => i.cancelledAt).length} รายการถูกยกเลิก
            </p>
          )}
          <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-navy">
            <span>รวม</span>
            <span>฿{order.totalTHB}</span>
          </div>
        </div>

        {/* Note */}
        {order.note && (
          <p className="mb-3 text-xs text-orange bg-orange/10 rounded-lg px-3 py-1.5">
            📝 หมายเหตุ: {order.note}
          </p>
        )}

        {/* Slip */}
        {order.payment?.slipUrl && (
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-1">💳 สลิปจากลูกค้า — แตะเพื่อดูเต็มจอ</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={order.payment.slipUrl}
              alt="slip"
              className="w-full max-h-48 object-contain rounded-xl border border-sand cursor-pointer active:opacity-80"
              onClick={() => onOpenSlip(order.payment!.slipUrl!)}
            />
          </div>
        )}

        {/* Per-item kitchen-done acknowledgment — dismiss alert as items complete */}
        {order.status !== "SERVED" && order.status !== "CANCELLED" && (() => {
          const unackedReady = order.items.filter((i) => !i.cancelledAt && i.kitchenServedAt && !kitchenItemAcked.has(i.id));
          if (unackedReady.length === 0) return null;
          return (
            <div className="mb-2">
              <button
                onClick={() => onAckKitchenItems(unackedReady.map((i) => i.id))}
                className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 text-navy font-bold py-2.5 rounded-xl text-sm transition-colors"
              >
                🔔 รับทราบ ({unackedReady.length} เมนูพร้อม) — หยุดเสียงแจ้งเตือน
              </button>
            </div>
          );
        })()}

        {/* Confirm serve — required for ALL CONFIRMED/PAID orders */}
        {(order.status === "CONFIRMED" || order.status === "PAID") && !isBillTab && (
          <div className="mb-2">
            {!servedAcked.has(order.id) ? (
              <button
                onClick={() => onServeAck(order.id)}
                className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl text-sm transition-colors ${
                  kitchenDone
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300"
                }`}
              >
                🍽️ {kitchenDone ? "ยืนยันการเสิร์ฟ (ครบทุกเมนูแล้ว)" : "ยืนยันการเสิร์ฟ"}
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-xl py-2.5 text-sm text-green-700 font-semibold">
                ✅ เสิร์ฟถึงโต๊ะแล้ว
              </div>
            )}
          </div>
        )}

        {/* Primary action — payment state machine */}
        {isPendingTab ? (
          <div className="mb-2 space-y-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center text-sm text-amber-700">
              <p className="font-semibold">🧾 จ่ายตอนเช็กเอาท์</p>
              <p className="text-xs text-amber-500 mt-0.5">กดรับออเดอร์เพื่อส่งครัวทำ</p>
            </div>
            <button
              onClick={() => onUpdate(order.id, "CONFIRMED")}
              disabled={isLoading}
              className="w-full text-sm font-bold py-3 rounded-xl bg-navy text-cream transition-opacity disabled:opacity-60"
            >
              {isLoading ? "กำลังบันทึก..." : "✅ รับออเดอร์ — ส่งครัวทำ"}
            </button>
          </div>
        ) : isPendingCash ? (
          <div className="mb-2 space-y-2">
            <p className="text-xs text-gray-400 text-center">รับออเดอร์ · เลือกวิธีชำระเงิน</p>
            {orderDiscountAmount && orderDiscountAmount > 0 ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                <p className="text-sm text-green-700 font-semibold">💸 ส่วนลด −฿{orderDiscountAmount.toLocaleString()}</p>
                <button onClick={() => onRemoveOrderDiscount?.(order.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">ลบ</button>
              </div>
            ) : (
              <button onClick={() => onSetOrderDiscount?.(order)} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-orange border-2 border-dashed border-orange/40 hover:border-orange hover:bg-orange/5 rounded-xl py-2.5 transition-colors">
                💸 เพิ่มส่วนลด
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onOpenCashModal(order)}
                disabled={isLoading}
                className="flex flex-col items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors"
              >
                <span className="text-xl">💵</span>เงินสด
              </button>
              <button
                onClick={() => onChooseScan(order)}
                disabled={isLoading}
                className="flex flex-col items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors"
              >
                <span className="text-xl">📷</span>{isLoading ? "..." : "สแกน QR"}
              </button>
              <button onClick={() => onSplitOrder(order)} disabled={isLoading}
                className="flex flex-col items-center gap-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors">
                <span className="text-xl">✂️</span>แบ่งจ่าย
              </button>
            </div>
          </div>
        ) : isPendingQrNoSlip ? (
          <div className="mb-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-center text-sm text-blue-600">
            <p className="font-semibold">📷 รอสลิปจากลูกค้า</p>
            <p className="text-xs text-blue-400 mt-0.5">ลูกค้ากำลังโอนเงินและส่งสลิป</p>
          </div>
        ) : isPendingQrSlip ? (
          <button
            onClick={() => onConfirmQr(order)}
            disabled={isLoading}
            className="w-full text-sm font-bold py-3 rounded-xl mb-2 bg-teal-600 text-white transition-opacity disabled:opacity-60"
          >
            {isLoading ? "กำลังบันทึก..." : `✅ ยืนยันสลิป ฿${(order.payment?.amountTHB ?? order.totalTHB).toLocaleString()}`}
          </button>
        ) : isBillTab ? (
          // TAB order linked to a bill — payment happens at bill checkout, not here
          <div className="mb-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center text-sm text-amber-700">
            <p className="font-semibold">🧾 รวมในบิลตี้ {order.bill?.name}</p>
            <p className="text-xs text-amber-500 mt-0.5">ชำระรวมตอนเช็กเอาท์ตี้</p>
          </div>
        ) : isTabOrder ? (
          <div className="mb-2 space-y-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center text-xs text-amber-700">
              🧾 รอชำระตอนเช็กเอาท์ — เมื่อลูกค้าพร้อมชำระเลือกวิธีด้านล่าง
            </div>
            {orderDiscountAmount && orderDiscountAmount > 0 ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                <p className="text-sm text-green-700 font-semibold">💸 ส่วนลด −฿{orderDiscountAmount.toLocaleString()}</p>
                <button onClick={() => onRemoveOrderDiscount?.(order.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">ลบ</button>
              </div>
            ) : (
              <button onClick={() => onSetOrderDiscount?.(order)} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-orange border-2 border-dashed border-orange/40 hover:border-orange hover:bg-orange/5 rounded-xl py-2.5 transition-colors">
                💸 เพิ่มส่วนลด
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onOpenCashModal(order)}
                disabled={isLoading}
                className="flex flex-col items-center gap-1 bg-green-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60"
              >
                <span className="text-xl">💵</span>เงินสด
              </button>
              <button
                onClick={() => onChooseScan(order)}
                disabled={isLoading}
                className="flex flex-col items-center gap-1 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60"
              >
                <span className="text-xl">📷</span>{isLoading ? "..." : "สแกน QR"}
              </button>
              <button onClick={() => onSplitOrder(order)} disabled={isLoading}
                className="flex flex-col items-center gap-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors">
                <span className="text-xl">✂️</span>แบ่งจ่าย
              </button>
            </div>
          </div>
        ) : needsMethod ? (
          <div className="mb-2 space-y-2">
            <p className="text-xs text-gray-400 text-center">เลือกวิธีชำระเงิน</p>
            {orderDiscountAmount && orderDiscountAmount > 0 ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                <p className="text-sm text-green-700 font-semibold">💸 ส่วนลด −฿{orderDiscountAmount.toLocaleString()}</p>
                <button onClick={() => onRemoveOrderDiscount?.(order.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">ลบ</button>
              </div>
            ) : (
              <button onClick={() => onSetOrderDiscount?.(order)} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-orange border-2 border-dashed border-orange/40 hover:border-orange hover:bg-orange/5 rounded-xl py-2.5 transition-colors">
                💸 เพิ่มส่วนลด
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onOpenCashModal(order)}
                disabled={isLoading}
                className="flex flex-col items-center gap-1 bg-green-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60"
              >
                <span className="text-xl">💵</span>เงินสด
              </button>
              <button
                onClick={() => onChooseScan(order)}
                disabled={isLoading}
                className="flex flex-col items-center gap-1 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60"
              >
                <span className="text-xl">📷</span>{isLoading ? "..." : "สแกน QR"}
              </button>
              <button onClick={() => onSplitOrder(order)} disabled={isLoading}
                className="flex flex-col items-center gap-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors">
                <span className="text-xl">✂️</span>แบ่งจ่าย
              </button>
            </div>
          </div>
        ) : isCashPay ? (
          <div className="mb-2 space-y-2">
            <p className="text-xs text-gray-400 text-center">เลือกวิธีชำระเงิน</p>
            {orderDiscountAmount && orderDiscountAmount > 0 ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                <p className="text-sm text-green-700 font-semibold">💸 ส่วนลด −฿{orderDiscountAmount.toLocaleString()}</p>
                <button onClick={() => onRemoveOrderDiscount?.(order.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">ลบ</button>
              </div>
            ) : (
              <button onClick={() => onSetOrderDiscount?.(order)} className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-orange border-2 border-dashed border-orange/40 hover:border-orange hover:bg-orange/5 rounded-xl py-2.5 transition-colors">
                💸 เพิ่มส่วนลด
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onOpenCashModal(order)}
                disabled={isLoading}
                className="flex flex-col items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors"
              >
                <span className="text-xl">💵</span>เงินสด
              </button>
              <button
                onClick={() => onChooseScan(order)}
                disabled={isLoading}
                className="flex flex-col items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors"
              >
                <span className="text-xl">📷</span>{isLoading ? "..." : "สแกน QR"}
              </button>
              <button onClick={() => onSplitOrder(order)} disabled={isLoading}
                className="flex flex-col items-center gap-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors">
                <span className="text-xl">✂️</span>แบ่งจ่าย
              </button>
            </div>
          </div>
        ) : isQrNoSlip ? (
          <div className="mb-2 space-y-2">
            <button
              onClick={() => onResetPayment(order)}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-navy px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              ← เปลี่ยนวิธีชำระ
            </button>
            {qrUrl ? (
              <div className="text-center bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-blue-600 mb-2">ให้ลูกค้าสแกนเพื่อจ่าย ฿{order.totalTHB.toLocaleString()}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="QR" className="w-44 h-44 mx-auto rounded-lg object-contain bg-white" />
              </div>
            ) : (
              <button
                onClick={() => onChooseScan(order)}
                disabled={isLoading}
                className="w-full text-sm font-bold py-3 rounded-xl bg-blue-600 text-white disabled:opacity-60"
              >
                {isLoading ? "กำลังโหลด QR..." : "📷 แสดง QR ให้ลูกค้าสแกน"}
              </button>
            )}
            <button
              onClick={() => onConfirmQr(order)}
              disabled={isLoading}
              className="w-full text-sm font-bold py-3 rounded-xl bg-sage text-white transition-opacity disabled:opacity-60"
            >
              {isLoading ? "กำลังบันทึก..." : `✅ ยืนยันการชำระ ฿${order.totalTHB.toLocaleString()}`}
            </button>
          </div>
        ) : isQrSlip ? (
          <button
            onClick={() => onConfirmQr(order)}
            disabled={isLoading}
            className="w-full text-sm font-bold py-3 rounded-xl mb-2 bg-sage text-white transition-opacity disabled:opacity-60"
          >
            {isLoading ? "กำลังบันทึก..." : `✅ ยืนยันการชำระ ฿${order.totalTHB.toLocaleString()}`}
          </button>
        ) : order.status === "PAID" ? (
          // Payment done → close only after serve is acknowledged
          servedAcked.has(order.id) ? (
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => onPrint(order)}
                disabled={isLoading}
                className="flex-1 text-sm font-bold py-3 rounded-xl bg-white border-2 border-orange text-orange hover:bg-orange/5 transition-colors disabled:opacity-60"
              >
                🖨️ พิมพ์ใบเสร็จ
              </button>
              <button
                onClick={() => onUpdate(order.id, "SERVED")}
                disabled={isLoading}
                className="flex-1 text-sm font-bold py-3 rounded-xl bg-orange text-white hover:bg-orange/90 transition-colors disabled:opacity-60"
              >
                {isLoading ? "กำลังบันทึก..." : "✅ ปิดออเดอร์"}
              </button>
            </div>
          ) : (
            <div className="mb-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center text-xs text-amber-700">
              ✋ กดยืนยันการเสิร์ฟข้างบนก่อน เพื่อยืนยันว่าส่งอาหารถึงโต๊ะแล้ว
            </div>
          )
        ) : cfg.next ? (
          <button
            onClick={() => onUpdate(order.id, cfg.next!)}
            disabled={isLoading}
            className={`w-full text-sm font-bold py-3 rounded-xl mb-2 transition-opacity disabled:opacity-60 ${cfg.nextColor}`}
          >
            {isLoading ? "กำลังบันทึก..." : cfg.nextLabel}
          </button>
        ) : null}

        {/* Secondary actions */}
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={() => onEdit(order)}
              disabled={isLoading}
              className="flex-1 bg-gray-50 text-gray-600 border border-gray-200 text-sm font-medium py-2 rounded-xl disabled:opacity-40"
            >
              ✏️ แก้ไข
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => onUpdate(order.id, "CANCELLED")}
              disabled={isLoading}
              className="flex-1 bg-red-50 text-red-600 text-sm font-medium py-2 rounded-xl disabled:opacity-40"
            >
              ❌ ยกเลิก
            </button>
          )}
          {kitchenEnabled && order.status !== "SERVED" && order.status !== "CANCELLED" && (
            <button
              onClick={() => onKitchen(order)}
              className="bg-gray-50 text-gray-500 border border-gray-200 text-sm px-3 py-2 rounded-xl hover:bg-gray-100"
              title="แจ้งครัว"
            >
              🍳
            </button>
          )}
          <button
            onClick={() => onPrint(order)}
            className="bg-gray-50 text-gray-500 border border-gray-200 text-sm px-3 py-2 rounded-xl hover:bg-gray-100"
            title="พิมพ์ใบเสร็จ"
          >
            🖨️
          </button>
          <button
            onClick={() => onDelete(order.id)}
            disabled={isLoading}
            className="bg-gray-50 text-gray-400 border border-gray-100 text-sm px-3 py-2 rounded-xl disabled:opacity-40 hover:text-red-500 hover:border-red-100"
            title="ลบออเดอร์"
          >
            🗑️
          </button>
          <button
            onClick={() => onPurge(order.id, order.billId)}
            disabled={isLoading}
            className="bg-red-50 text-red-400 border border-red-100 text-xs px-2 py-2 rounded-xl disabled:opacity-40 hover:text-red-700 hover:border-red-300"
            title={order.billId ? "ทำลายบิลทั้งหมด" : "ลบออเดอร์นี้"}
          >
            ⛔
          </button>
        </div>
      </div>
    </div>
  );
}
