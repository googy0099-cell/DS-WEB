"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import type { OrderWithItems } from "@/types";

const DRINK_CATEGORIES = ["milktea", "coffee", "soda", "drink"];

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

function elapsed(createdAt: string) {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (diff < 60) return `${diff} วิ`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m} นาที`;
  return `${Math.floor(m / 60)} ชม. ${m % 60} นาที`;
}

function ElapsedBadge({ createdAt }: { createdAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  const minutes = Math.floor(diff / 60);
  const urgent = minutes >= 10;
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${urgent ? "bg-red-500 text-white animate-pulse" : "bg-black/20 text-white"}`}>
      ⏱ {elapsed(createdAt)}
    </span>
  );
}

function isReadyForKitchen(order: OrderWithItems) {
  if (order.status === "PAID") return true;
  if (order.status === "CONFIRMED") {
    const method = order.payment?.method;
    return !method || method === "UNSET" || method === "TAB";
  }
  return false;
}

function getLocationLabel(order: OrderWithItems) {
  if (order.bill) return `${order.bill.name} · โต๊ะ ${order.bill.table.number}`;
  if (order.tableId) return `โต๊ะ ${order.tableId}`;
  return order.orderName || `#${order.id}`;
}

// Flat item entry for the queue
interface QueueItem {
  itemId: number;
  orderId: number;
  orderCreatedAt: string;
  location: string;
  orderName: string;
  isTab: boolean;
  nameTh: string;
  selectedSize: string | null;
  selectedAddons: string | null;
  selectedOptions: string | null;
  quantity: number;
  orderNote: string | null;
}

export default function KitchenQueue({ type }: { type: "food" | "drink" }) {
  const { data: allOrders, mutate } = useSWR<OrderWithItems[]>(
    "/api/orders?status=active",
    fetcher,
    { refreshInterval: 4000 }
  );

  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const prevCountRef = useRef(0);
  const [kitchenSoundUrl, setKitchenSoundUrl] = useState<string>("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const kitchenBufRef = useRef<ArrayBuffer | null>(null);

  useEffect(() => {
    fetch("/api/site-settings")
      .then((r) => r.json())
      .then((data) => { if (data.kitchen_sound_url) setKitchenSoundUrl(data.kitchen_sound_url); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!kitchenSoundUrl) { kitchenBufRef.current = null; return; }
    fetch(kitchenSoundUrl).then((r) => r.arrayBuffer()).then((buf) => { kitchenBufRef.current = buf; }).catch(() => { kitchenBufRef.current = null; });
  }, [kitchenSoundUrl]);

  async function playCustomKitchen() {
    if (!kitchenBufRef.current) return false;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      const decoded = await ctx.decodeAudioData(kitchenBufRef.current.slice(0));
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      src.start();
      return true;
    } catch { return false; }
  }

  // Build a flat list of pending items, one entry per item
  const queueItems: QueueItem[] = [];
  for (const order of allOrders ?? []) {
    if (!isReadyForKitchen(order)) continue;
    for (const item of order.items) {
      const isRelevant = type === "drink"
        ? DRINK_CATEGORIES.includes(item.menuItem.category)
        : !DRINK_CATEGORIES.includes(item.menuItem.category);
      if (!isRelevant) continue;
      if (item.kitchenServedAt) continue; // already done
      queueItems.push({
        itemId: item.id,
        orderId: order.id,
        orderCreatedAt: order.createdAt,
        location: getLocationLabel(order),
        orderName: order.orderName,
        isTab: order.status === "CONFIRMED",
        nameTh: item.menuItem.nameTh,
        selectedSize: item.selectedSize,
        selectedAddons: item.selectedAddons,
        selectedOptions: item.selectedOptions,
        quantity: item.quantity,
        orderNote: order.note ?? null,
      });
    }
  }
  // FIFO: sort by order creation time
  queueItems.sort((a, b) => new Date(a.orderCreatedAt).getTime() - new Date(b.orderCreatedAt).getTime());

  // Flash tab title when new items arrive
  useEffect(() => {
    if (queueItems.length > prevCountRef.current && prevCountRef.current !== 0) {
      document.title = `🔔 รายการใหม่! (${queueItems.length})`;
      const t = setTimeout(() => {
        document.title = type === "food" ? "🍳 คิวครัว" : "🥤 คิวบาร์";
      }, 5000);
      return () => clearTimeout(t);
    }
    prevCountRef.current = queueItems.length;
  }, [queueItems.length, type]);

  async function markItemDone(itemId: number) {
    if (loadingIds.has(itemId)) return;
    setLoadingIds((prev) => { const s = new Set(prev); s.add(itemId); return s; });
    try {
      const res = await fetch(`/api/orders/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitchenDone: true }),
      });
      if (res.ok) {
        const played = await playCustomKitchen();
        if (!played) playDoneChime();
      }
      await mutate();
    } finally {
      setLoadingIds((prev) => { const s = new Set(prev); s.delete(itemId); return s; });
    }
  }

  if (!allOrders) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2 animate-pulse">{type === "drink" ? "🥤" : "🍳"}</div>
          <p className="text-sm">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (queueItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-6xl mb-4">{type === "drink" ? "🥤" : "🍳"}</div>
          <p className="text-xl font-bold text-gray-400">ไม่มีรายการในคิว</p>
          <p className="text-sm text-gray-300 mt-1">รีเฟรชทุก 4 วินาที</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {queueItems.map((qi, idx) => {
        const isLoading = loadingIds.has(qi.itemId);
        const isFirst = idx === 0;
        const addons: { nameTh: string }[] = qi.selectedAddons ? JSON.parse(qi.selectedAddons) : [];
        const options: { groupName: string; choiceName: string }[] = qi.selectedOptions ? JSON.parse(qi.selectedOptions) : [];

        return (
          <div
            key={qi.itemId}
            className={`rounded-2xl shadow-sm overflow-hidden flex flex-row items-stretch transition-all ${
              isFirst ? "ring-2 ring-orange shadow-orange/20 shadow-md" : "bg-white border border-gray-100"
            }`}
          >
            {/* Left accent — number + badge */}
            <div className={`flex flex-col items-center justify-center px-4 py-3 shrink-0 ${isFirst ? "bg-orange" : "bg-navy"}`}>
              <span className="text-white font-black text-xl leading-none">#{idx + 1}</span>
              {isFirst && (
                <span className="text-white/80 text-[10px] font-semibold mt-1">ต่อไป</span>
              )}
            </div>

            {/* Middle — full order details */}
            <div className="flex-1 min-w-0 px-4 py-3 bg-white flex flex-col justify-start gap-1">
              {/* Location + meta row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-bold ${isFirst ? "text-orange" : "text-navy"}`}>
                  📍 {qi.location}
                </span>
                {qi.orderName && (
                  <span className="text-xs text-gray-400">· 👤 {qi.orderName}</span>
                )}
                {qi.isTab && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">TAB</span>
                )}
                <ElapsedBadge createdAt={qi.orderCreatedAt} />
              </div>

              {/* Item name + quantity */}
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`font-black text-lg leading-tight ${isFirst ? "text-orange" : "text-navy"}`}>{qi.nameTh}</span>
                <span className="text-xl font-black text-orange">×{qi.quantity}</span>
              </div>

              {/* Size */}
              {qi.selectedSize && (
                <span className="self-start text-xs font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                  {qi.selectedSize}
                </span>
              )}

              {/* Addons */}
              {addons.length > 0 && (
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {addons.map((a, i) => (
                    <span key={i} className="text-sm font-semibold text-emerald-700">
                      + {a.nameTh}
                    </span>
                  ))}
                </div>
              )}

              {/* Options (sweetness, spiciness, etc.) */}
              {options.length > 0 && (
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {options.map((o, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400 shrink-0">{o.groupName}:</span>
                      <span className="text-sm font-bold text-purple-700">{o.choiceName}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Order note */}
              {qi.orderNote && (
                <div className="mt-1.5 flex items-start gap-1.5 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1.5">
                  <span className="text-sm shrink-0">📝</span>
                  <span className="text-sm font-bold text-amber-800">{qi.orderNote}</span>
                </div>
              )}
            </div>

            {/* Right — done button */}
            <div className="flex items-center px-3 py-3 bg-white shrink-0">
              <button
                onClick={() => markItemDone(qi.itemId)}
                disabled={isLoading}
                className="py-2.5 px-4 rounded-xl font-black text-sm transition-all disabled:opacity-50 bg-green-500 hover:bg-green-600 active:scale-95 text-white shadow-sm whitespace-nowrap"
              >
                {isLoading ? "กำลังบันทึก..." : "✅ เสร็จแล้ว"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
