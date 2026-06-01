"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { formatThaiDateTime } from "@/lib/thai-datetime";
import type { OrderWithItems } from "@/types";
import {
  buildReceiptEscPos, buildKitchenEscPos, printToSerial,
  getGrantedPrinter,
} from "@/lib/thermal-print";

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
  // Try silent serial print first
  const hasPrinter = await getGrantedPrinter();
  if (hasPrinter) {
    const data = buildReceiptEscPos(
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
      }
    );
    const ok = await printToSerial(data);
    if (ok) return;
  }
  // Fallback: browser print window
  const dateStr = formatThaiDateTime(order.createdAt);
  const w = settings.paperWidth === "A4" ? "210mm" : `${settings.paperWidth}mm`;
  const itemsHtml = order.items
    .map((item) => {
      const addons: { nameTh: string }[] = item.selectedAddons ? JSON.parse(item.selectedAddons) : [];
      const options: { groupName: string; choiceName: string }[] = item.selectedOptions ? JSON.parse(item.selectedOptions) : [];
      const subtotal = item.unitPriceTHB * item.quantity;
      const extras = [
        addons.length > 0 ? `+ ${addons.map((a) => a.nameTh).join(", ")}` : "",
        options.length > 0 ? options.map((o) => `${o.groupName}: ${o.choiceName}`).join(", ") : "",
      ].filter(Boolean).join(" | ");
      return `<tr>
        <td style="padding:4px 2px;vertical-align:top">
          ${item.menuItem.nameTh}${item.selectedSize ? ` (${item.selectedSize})` : ""} ×${item.quantity}
          ${extras ? `<br/><small style="color:#888">${extras}</small>` : ""}
        </td>
        ${settings.showItemPrice ? `<td style="padding:4px 2px;text-align:right;vertical-align:top;white-space:nowrap">฿${subtotal}</td>` : ""}
      </tr>`;
    })
    .join("");

  openPrintWindow(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><title>ใบเสร็จ #${order.id}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Sarabun','Helvetica Neue',Arial,sans-serif;font-size:13px;color:#111;width:${w};margin:0 auto;padding:8px}.logo{display:block;max-width:120px;max-height:60px;margin:0 auto 6px;object-fit:contain}h1{font-size:18px;font-weight:900;text-align:center;margin-bottom:2px}.sub{font-size:11px;text-align:center;color:#555;margin-bottom:8px}.divider{border:none;border-top:1px dashed #aaa;margin:6px 0}table{width:100%;border-collapse:collapse}.total-row td{font-weight:bold;font-size:15px;padding-top:6px;border-top:1px dashed #aaa}.note{background:#fff8e7;border:1px solid #f5a623;border-radius:4px;padding:5px 8px;margin-top:6px;font-size:12px}.footer{text-align:center;font-size:11px;color:#777;margin-top:10px}@media print{body{width:100%}}</style>
</head><body>
${settings.logoUrl ? `<img src="${settings.logoUrl}" class="logo" alt="logo"/>` : ""}
<h1>${settings.logoUrl ? "" : "🎲 "}${settings.shopName}</h1>
<div class="sub">${settings.shopInfo} • ใบเสร็จรับเงิน</div>
<hr class="divider"/>
<div style="font-size:12px;margin-bottom:4px">
${settings.showCustomer ? `<div><b>ออเดอร์:</b> ${order.orderName || `#${order.id}`}</div>` : ""}
${settings.showOrderId ? `<div><b>เลขที่:</b> #${order.id}</div>` : ""}
${settings.showDate ? `<div><b>วันที่:</b> ${dateStr}</div>` : ""}
</div>
<hr class="divider"/>
<table><tbody>${itemsHtml}</tbody>
${settings.showTotal ? `<tfoot><tr class="total-row"><td>รวมทั้งหมด</td><td style="text-align:right">฿${order.totalTHB}</td></tr></tfoot>` : ""}
</table>
${settings.showNote && order.note ? `<div class="note">📝 หมายเหตุ: ${order.note}</div>` : ""}
<div class="footer">${settings.footer}</div>
</body></html>`);
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

function resolveStatusBadge(order: OrderWithItems) {
  const method = order.payment?.method;
  const hasSlip = !!order.payment?.slipUrl;
  const kitchenDone = order.items.length > 0 && order.items.every((i) => !!i.kitchenServedAt);

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

  const prevIdsRef = useRef<Set<number>>(new Set());
  const prevKitchenDoneRef = useRef<Set<number>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alertBufRef = useRef<ArrayBuffer | null>(null);
  const kitchenBufRef = useRef<ArrayBuffer | null>(null);
  const alertLoopRef = useRef<AudioBufferSourceNode | null>(null);
  const kitchenLoopRef = useRef<AudioBufferSourceNode | null>(null);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [servedAcked, setServedAcked] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("servedAcked") ?? "[]") as number[];
      setServedAcked(new Set(stored));
    } catch {}
  }, []);

  function markServedAck(orderId: number) {
    setServedAcked((prev) => {
      const next = new Set(prev);
      next.add(orderId);
      try { localStorage.setItem("servedAcked", JSON.stringify([...next])); } catch {}
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
  // QR data URLs for scan-at-counter, keyed by order id
  const [qrMap, setQrMap] = useState<Record<number, string>>({});

  // Edit modal state
  const [editOrder, setEditOrder] = useState<OrderWithItems | null>(null);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  // Orders that still need immediate staff action (alert beeps for these)
  // Cashier-created orders (handledById set) and bill-linked TAB orders are excluded
  const alertOrders = (orders ?? []).filter((o) => {
    if (o.handledById) return false; // counter order, staff already knows
    const m = o.payment?.method;
    // Bill-linked TAB orders pay at checkout — no alert needed
    if (m === "TAB" && o.billId) return false;
    // PENDING with payment method selected — needs staff to process
    if (o.status === "PENDING") return m === "CASH" || m === "PROMPTPAY" || m === "TAB";
    // CONFIRMED non-cashier orders waiting for payment
    if (o.status === "CONFIRMED") return !m || m === "UNSET" || m === "CASH" || m === "PROMPTPAY";
    return false;
  });

  // Orders where ALL items are kitchen-done but bill is not yet closed AND staff hasn't acknowledged serve
  const kitchenReadyOrders = (orders ?? []).filter(
    (o) => o.status !== "SERVED" && o.status !== "CANCELLED" &&
           o.items.length > 0 && o.items.every((i) => !!i.kitchenServedAt) &&
           !servedAcked.has(o.id)
  );

  // Clean up servedAcked for orders no longer active (SERVED, CANCELLED, deleted)
  useEffect(() => {
    if (!orders) return;
    const activeIds = new Set(orders.map((o) => o.id));
    setServedAcked((prev) => {
      const next = new Set([...prev].filter((id) => activeIds.has(id)));
      if (next.size !== prev.size) {
        try { localStorage.setItem("servedAcked", JSON.stringify([...next])); } catch {}
        return next;
      }
      return prev;
    });
  }, [orders]);

  // Fire beep when NEW orders arrive; fire chime when NEW kitchen-done events arrive
  useEffect(() => {
    if (!orders) return;

    const newOrders = orders.filter((o) => {
      if (prevIdsRef.current.has(o.id)) return false;
      if (o.handledById) return false; // counter order — no alert
      const m = o.payment?.method;
      if (o.status === "CONFIRMED" || o.status === "PAID") return true;
      return o.status === "PENDING" && (m === "CASH" || m === "PROMPTPAY");
    });

    const newKitchenDone = orders.filter(
      (o) => o.items.length > 0 && o.items.every((i) => !!i.kitchenServedAt) && !prevKitchenDoneRef.current.has(o.id)
    );

    if (alertEnabled) {
      void (async () => {
        if (newOrders.length > 0) {
          try {
            const played = await playCustom(alertBufRef);
            if (!played) {
              if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
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
      orders.filter((o) => o.items.length > 0 && o.items.every((i) => !!i.kitchenServedAt)).map((o) => o.id)
    );
  }, [orders, alertEnabled]);

  // Loop alert sound while unacknowledged orders exist — stop when cleared
  useEffect(() => {
    const hasAlerts = alertEnabled && alertOrders.length > 0;

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
      // Fallback: synthesized beep on repeat (no notification spam)
      if (!cancelled) {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        playBeep(audioCtxRef.current);
        fallbackInterval = setInterval(() => {
          if (!cancelled && audioCtxRef.current) playBeep(audioCtxRef.current);
        }, 2500);
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
  }, [alertEnabled, alertOrders.length > 0, alertSoundUrl]);

  // Loop kitchen chime while food-ready orders are unserved — stop when cleared
  useEffect(() => {
    const hasReady = alertEnabled && kitchenReadyOrders.length > 0;

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
  }, [alertEnabled, kitchenReadyOrders.length > 0, kitchenSoundUrl]);

  function setLoading(id: number, on: boolean) {
    setLoadingIds((prev) => {
      const s = new Set(prev);
      on ? s.add(id) : s.delete(id);
      return s;
    });
  }

  async function updateStatus(orderId: number, status: string) {
    if (loadingIds.has(orderId)) return;
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

  function openCashModal(order: OrderWithItems) {
    setCashOrder(order);
    setCashInputStr("");
  }

  async function confirmCashPayment() {
    if (!cashOrder) return;
    const received = parseInt(cashInputStr.replace(/,/g, ""), 10) || 0;
    if (received < cashOrder.totalTHB) return;
    const change = received - cashOrder.totalTHB;
    const order = cashOrder;
    setLoading(order.id, true);
    await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmCash: true, receivedAmount: received, changeAmount: change }),
    });
    setCashOrder(null);
    setCashInputStr("");
    printReceipt(order, receiptSettings);
    await mutate();
    setLoading(order.id, false);
  }

  async function confirmBillGroupCash() {
    if (!billGroupCash) return;
    const received = parseInt(billCashInputStr.replace(/,/g, ""), 10) || 0;
    if (received < billGroupCash.total) return;
    setBillGroupCashLoading(true);
    try {
      await fetch(`/api/pos/bills/${billGroupCash.billId}/tab-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUserId: null }),
      });
      setBillGroupCash(null);
      setBillCashInputStr("");
      await mutate();
    } finally {
      setBillGroupCashLoading(false);
    }
  }

  async function confirmQrPayment(order: OrderWithItems) {
    if (!order.payment?.id) return;
    setLoading(order.id, true);
    await fetch("/api/payment/confirm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: order.payment.id }),
    });
    printReceipt(order, receiptSettings);
    await mutate();
    setLoading(order.id, false);
  }

  // Cashier picked "สแกน": generate an amount-embedded QR and lock method to PROMPTPAY
  async function chooseScan(order: OrderWithItems) {
    setLoading(order.id, true);
    try {
      const res = await fetch("/api/payment/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
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
      order.items.map((item) => ({
        id: item.id,
        nameTh: item.menuItem.nameTh,
        selectedSize: item.selectedSize,
        unitPrice: item.unitPriceTHB,
        quantity: item.quantity,
      }))
    );
    setEditNote(order.note ?? "");
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
      await fetch(`/api/orders/${editOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: editItems.map((i) => ({ id: i.id, quantity: i.quantity })),
          note: editNote,
        }),
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
            {pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isNew
                isLoading={loadingIds.has(order.id)}
                onUpdate={handleUpdate}
                onEdit={openEdit}
                onDelete={handleDelete}
                onPrint={(o) => printReceipt(o, receiptSettings)}
                onKitchen={(o) => printKitchen(o, kitchenSettings)}
                kitchenEnabled={kitchenSettings.enabled}
                onOpenCashModal={openCashModal}
                onConfirmQr={confirmQrPayment}
                onChooseScan={chooseScan}
                qrUrl={qrMap[order.id]}
                servedAcked={servedAcked}
                onServeAck={markServedAck}
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
                    setBillGroupCash({
                      billId: orders[0].billId!,
                      billName: orders[0].bill?.name ?? "",
                      orders,
                      total: orders.reduce((s, o) => s + o.totalTHB, 0),
                    });
                    setBillCashInputStr("");
                  }}
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
                  onPrint={(o) => printReceipt(o, receiptSettings)}
                  onKitchen={(o) => printKitchen(o, kitchenSettings)}
                  kitchenEnabled={kitchenSettings.enabled}
                  onOpenCashModal={openCashModal}
                  onConfirmQr={confirmQrPayment}
                  onChooseScan={chooseScan}
                  qrUrl={qrMap[item.order.id]}
                  servedAcked={servedAcked}
                  onServeAck={markServedAck}
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
            ) : (
              todayOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm opacity-80">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-navy">👤 {order.orderName || `ออเดอร์ #${order.id}`}</p>
                      <p className="text-xs text-gray-400">{formatThaiDateTime(order.createdAt)}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.color ?? "bg-gray-100 text-gray-500"}`}
                    >
                      {STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.label ?? order.status}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 space-y-1">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-xs text-gray-600">
                        <span>
                          {item.menuItem.nameTh} ×{item.quantity}
                        </span>
                        <span>฿{item.unitPriceTHB * item.quantity}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 pt-1 flex justify-between text-sm font-bold text-navy">
                      <span>รวม</span>
                      <span>฿{order.totalTHB}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-3">
                    <button
                      onClick={() => printReceipt(order)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      🖨️ พิมพ์ใบเสร็จ
                    </button>
                    <button
                      onClick={() => handleDelete(order.id)}
                      disabled={loadingIds.has(order.id)}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                    >
                      🗑️ ลบ
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Cash payment modal */}
      {cashOrder && (() => {
        const received = parseInt(cashInputStr.replace(/,/g, ""), 10) || 0;
        const change = received - cashOrder.totalTHB;
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
                <p className="text-3xl font-bold text-orange">฿{cashOrder.totalTHB.toLocaleString()}</p>
              </div>

              {/* Amount display */}
              <div className="w-full border-2 border-sand rounded-xl px-4 py-3 text-2xl font-bold text-navy text-center bg-gray-50 min-h-[56px]">
                {cashInputStr ? `฿${received.toLocaleString()}` : <span className="text-gray-300">฿0</span>}
              </div>

              {/* Change / shortfall */}
              {cashInputStr && (
                <div className={`rounded-xl p-2.5 text-center ${received >= cashOrder.totalTHB ? "bg-green-50" : "bg-red-50"}`}>
                  {received >= cashOrder.totalTHB ? (
                    <><p className="text-xs text-green-600">เงินทอน</p><p className="text-2xl font-bold text-green-700">฿{change.toLocaleString()}</p></>
                  ) : (
                    <p className="text-sm font-semibold text-red-500">ขาดอีก ฿{(cashOrder.totalTHB - received).toLocaleString()}</p>
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
                  disabled={!cashInputStr || received < cashOrder.totalTHB}
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
        const received = parseInt(billCashInputStr.replace(/,/g, ""), 10) || 0;
        const change = received - billGroupCash.total;
        function pressDigit(d: string) { setBillCashInputStr((prev) => (prev === "" || prev === "0") ? d : prev + d); }
        function pressBack() { setBillCashInputStr((prev) => prev.slice(0, -1)); }
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl space-y-3">
              <h3 className="font-bold text-navy text-lg text-center">รับเงินสด — ตี้ {billGroupCash.billName}</h3>
              <p className="text-xs text-center text-gray-400">{billGroupCash.orders.length} ออเดอร์รวมกัน</p>
              <div className="text-center">
                <p className="text-xs text-gray-400">ยอดรวมที่ต้องชำระ</p>
                <p className="text-3xl font-bold text-orange">฿{billGroupCash.total.toLocaleString()}</p>
              </div>
              <div className="w-full border-2 border-sand rounded-xl px-4 py-3 text-2xl font-bold text-navy text-center bg-gray-50 min-h-[56px]">
                {billCashInputStr ? `฿${received.toLocaleString()}` : <span className="text-gray-300">฿0</span>}
              </div>
              {billCashInputStr && (
                <div className={`rounded-xl p-2.5 text-center ${received >= billGroupCash.total ? "bg-green-50" : "bg-red-50"}`}>
                  {received >= billGroupCash.total
                    ? <><p className="text-xs text-green-600">เงินทอน</p><p className="text-2xl font-bold text-green-700">฿{change.toLocaleString()}</p></>
                    : <p className="text-sm font-semibold text-red-500">ขาดอีก ฿{(billGroupCash.total - received).toLocaleString()}</p>}
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
                <button onClick={() => { setBillGroupCash(null); setBillCashInputStr(""); }}
                  className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm font-semibold">ยกเลิก</button>
                <button onClick={confirmBillGroupCash} disabled={!billCashInputStr || received < billGroupCash.total || billGroupCashLoading}
                  className="flex-1 bg-green-600 text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40">
                  {billGroupCashLoading ? "กำลังบันทึก..." : "✅ ชำระแล้ว"}
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
                  confirmAction.onConfirm();
                  setConfirmAction(null);
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
    </div>
  );
}

function BillOrderGroupCard({
  orders,
  servedAcked,
  onServeAck,
  isLoading,
  onOpenCashModal,
}: {
  orders: OrderWithItems[];
  servedAcked: Set<number>;
  onServeAck: (id: number) => void;
  isLoading: boolean;
  onOpenCashModal: (orders: OrderWithItems[]) => void;
}) {
  const first = orders[0];
  const bill = first.bill;
  const bc = BILL_COLOR_MAP[bill?.color ?? "indigo"] ?? BILL_COLOR_MAP.indigo;
  const totalTHB = orders.reduce((s, o) => s + o.totalTHB, 0);
  const allItems = orders.flatMap((o) => o.items);
  const kitchenDone = allItems.length > 0 && allItems.every((i) => !!i.kitchenServedAt);
  const allServedAcked = orders.every((o) => servedAcked.has(o.id));

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
        <span className="text-xs font-semibold px-2 py-1 rounded-full border shrink-0 bg-amber-100 text-amber-800 border-amber-300">
          🧾 รอชำระรวม
        </span>
      </div>

      {/* All items from all orders */}
      <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-3">
        {sorted.map((order, oi) => (
          <div key={order.id}>
            {orders.length > 1 && (
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                ออเดอร์ {oi + 1} · 👤 {order.orderName} · {formatThaiDateTime(order.createdAt)}
              </p>
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
                      {item.kitchenServedAt
                        ? <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">✅ พร้อม</span>
                        : <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">🍳 กำลังทำ</span>}
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
        <div className="border-t border-gray-200 pt-1.5 flex justify-between font-black text-navy text-base">
          <span>รวมทั้งหมด</span>
          <span>฿{totalTHB.toLocaleString()}</span>
        </div>
      </div>

      {/* Serve ack */}
      {kitchenDone && (
        <div className="mb-2">
          {!allServedAcked ? (
            <button
              onClick={() => orders.forEach((o) => onServeAck(o.id))}
              className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              🍽️ เสิร์ฟแล้ว — หยุดแจ้งเตือน
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-xl py-2.5 text-sm text-green-700 font-semibold">
              ✅ เสิร์ฟถึงโต๊ะแล้ว
            </div>
          )}
        </div>
      )}

      {/* Payment */}
      <button
        onClick={() => onOpenCashModal(orders)}
        disabled={isLoading}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors"
      >
        💵 {isLoading ? "กำลังบันทึก..." : `ชำระเงินสด ฿${totalTHB.toLocaleString()}`}
      </button>
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
  onPrint,
  onKitchen,
  kitchenEnabled,
  onOpenCashModal,
  onConfirmQr,
  onChooseScan,
  qrUrl,
  servedAcked,
  onServeAck,
}: {
  order: OrderWithItems;
  isNew: boolean;
  isLoading: boolean;
  onUpdate: (id: number, status: string) => void;
  onEdit: (order: OrderWithItems) => void;
  onDelete: (id: number) => void;
  onPrint: (order: OrderWithItems) => void;
  onKitchen: (order: OrderWithItems) => void;
  kitchenEnabled: boolean;
  onOpenCashModal: (order: OrderWithItems) => void;
  onConfirmQr: (order: OrderWithItems) => void;
  onChooseScan: (order: OrderWithItems) => void;
  qrUrl?: string;
  servedAcked: Set<number>;
  onServeAck: (id: number) => void;
}) {
  const badge = resolveStatusBadge(order);
  const cfg = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING;
  const canCancel = order.status === "PENDING" || order.status === "CONFIRMED";
  const canEdit = order.status === "PENDING" || order.status === "CONFIRMED" || order.status === "PAID";

  const isConfirmed = order.status === "CONFIRMED";
  const isPending = order.status === "PENDING";
  const method = order.payment?.method;
  const hasSlip = !!order.payment?.slipUrl;
  const kitchenDone = order.items.length > 0 && order.items.every((i) => !!i.kitchenServedAt);

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
          {order.items.map((item) => {
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
                    {inKitchen && !item.kitchenServedAt && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                        🍳 กำลังทำ
                      </span>
                    )}
                    {item.kitchenServedAt && (
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
            <p className="text-xs text-gray-400 mb-1">💳 สลิปจากลูกค้า</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={order.payment.slipUrl}
              alt="slip"
              className="w-full max-h-48 object-contain rounded-xl border border-sand cursor-pointer"
              onClick={() => window.open(order.payment!.slipUrl!, "_blank")}
            />
          </div>
        )}

        {/* Serve acknowledgment — appears on ALL kitchen-done orders that aren't yet closed */}
        {kitchenDone && order.status !== "SERVED" && order.status !== "CANCELLED" && (
          <div className="mb-2">
            {!servedAcked.has(order.id) ? (
              <button
                onClick={() => onServeAck(order.id)}
                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                🍽️ เสิร์ฟแล้ว — หยุดแจ้งเตือน
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
          <button
            onClick={() => onUpdate(order.id, "PAID")}
            disabled={isLoading}
            className="w-full text-sm font-bold py-3 rounded-xl mb-2 bg-indigo-600 text-white transition-opacity disabled:opacity-60"
          >
            {isLoading ? "กำลังบันทึก..." : `💵 รับชำระแล้ว ฿${order.totalTHB.toLocaleString()}`}
          </button>
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
            {isLoading ? "กำลังบันทึก..." : `✅ ยืนยันสลิป ฿${order.totalTHB.toLocaleString()}`}
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
            <div className="grid grid-cols-2 gap-2">
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
                <span className="text-xl">📷</span>{isLoading ? "..." : "สแกน"}
              </button>
            </div>
          </div>
        ) : needsMethod ? (
          <div className="mb-2">
            <p className="text-xs text-gray-400 mb-1.5 text-center">เลือกวิธีชำระเงิน</p>
            <div className="grid grid-cols-2 gap-2">
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
                <span className="text-xl">📷</span>{isLoading ? "..." : "สแกน"}
              </button>
            </div>
          </div>
        ) : isCashPay ? (
          <button
            onClick={() => onOpenCashModal(order)}
            disabled={isLoading}
            className="w-full text-sm font-bold py-3 rounded-xl mb-2 bg-green-600 text-white transition-opacity disabled:opacity-60"
          >
            {isLoading ? "กำลังบันทึก..." : `💵 ชำระเงิน ฿${order.totalTHB.toLocaleString()}`}
          </button>
        ) : isQrNoSlip ? (
          <div className="mb-2 space-y-2">
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
        ) : order.status === "PAID" && kitchenDone ? (
          // Payment done + kitchen done → close only after serve is acknowledged
          servedAcked.has(order.id) ? (
            <button
              onClick={() => { onPrint(order); onUpdate(order.id, "SERVED"); }}
              disabled={isLoading}
              className="w-full text-sm font-bold py-3 rounded-xl mb-2 bg-orange text-white hover:bg-orange/90 transition-colors disabled:opacity-60"
            >
              🖨️ {isLoading ? "กำลังบันทึก..." : "พิมพ์ใบเสร็จ · ปิดออเดอร์"}
            </button>
          ) : (
            <div className="mb-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center text-xs text-amber-700">
              ✋ กดเสิร์ฟแล้วข้างบนก่อน เพื่อยืนยันว่าส่งอาหารถึงโต๊ะแล้ว
            </div>
          )
        ) : order.status === "PAID" ? (
          // Paid but kitchen still working — info only
          <div className="mb-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center text-sm text-amber-700">
            <p className="font-semibold">🍳 ชำระแล้ว — รอครัวยืนยันว่าเสร็จ</p>
            <p className="text-xs text-amber-500 mt-0.5">ออเดอร์จะพร้อมปิดเมื่อครัวกดเสร็จแล้ว</p>
          </div>
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
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
