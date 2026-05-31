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

  useEffect(() => {
    fetch("/api/site-settings")
      .then((r) => r.json())
      .then((data) => { if (data.kitchen_sound_url) setKitchenSoundUrl(data.kitchen_sound_url); })
      .catch(() => {});
  }, []);

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
        if (kitchenSoundUrl) { new Audio(kitchenSoundUrl).play().catch(() => {}); }
        else playDoneChime();
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {queueItems.map((qi, idx) => {
        const isLoading = loadingIds.has(qi.itemId);
        const isFirst = idx === 0;
        const addons: { nameTh: string }[] = qi.selectedAddons ? JSON.parse(qi.selectedAddons) : [];
        const options: { groupName: string; choiceName: string }[] = qi.selectedOptions ? JSON.parse(qi.selectedOptions) : [];
        const extras = [
          qi.selectedSize ?? "",
          addons.map((a) => a.nameTh).join(", "),
          options.map((o) => o.choiceName).join(", "),
        ].filter(Boolean).join(" · ");

        return (
          <div
            key={qi.itemId}
            className={`rounded-2xl shadow flex flex-col overflow-hidden transition-all ${
              isFirst ? "ring-4 ring-orange shadow-orange/20 shadow-xl" : "bg-white border border-gray-100"
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 ${isFirst ? "bg-orange" : "bg-navy"}`}>
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-2xl">#{idx + 1}</span>
                {isFirst && (
                  <span className="text-white/80 text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                    ต่อไป
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {qi.isTab && (
                  <span className="text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">TAB</span>
                )}
                <ElapsedBadge createdAt={qi.orderCreatedAt} />
              </div>
            </div>

            {/* Location */}
            <div className={`px-4 py-2 border-b ${isFirst ? "bg-orange/10 border-orange/20" : "bg-gray-50 border-gray-100"}`}>
              <p className={`text-sm font-bold ${isFirst ? "text-orange" : "text-navy"}`}>
                📍 {qi.location}
              </p>
              {qi.orderName && (
                <p className="text-xs text-gray-400 mt-0.5">👤 {qi.orderName}</p>
              )}
            </div>

            {/* Item */}
            <div className="flex-1 px-4 py-4 bg-white flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-navy text-base leading-tight">{qi.nameTh}</p>
                {extras && <p className="text-xs text-gray-400 mt-0.5">{extras}</p>}
              </div>
              <span className="text-3xl font-black text-orange shrink-0">×{qi.quantity}</span>
            </div>

            {/* Done button */}
            <div className="px-4 pb-4 pt-2 bg-white">
              <button
                onClick={() => markItemDone(qi.itemId)}
                disabled={isLoading}
                className="w-full py-4 rounded-xl font-black text-lg transition-all disabled:opacity-50 bg-green-500 hover:bg-green-600 active:scale-95 text-white shadow-sm"
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
