"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import type { OrderWithItems } from "@/types";

const DRINK_CATEGORIES = ["milktea", "coffee", "soda", "drink"];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Pleasant two-note chime — distinct from the alert beep
function playDoneChime() {
  try {
    const ctx = new AudioContext();
    const notes = [880, 1108]; // A5 → C#6 (major third)
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
  if (order.bill) {
    return `${order.bill.name} · โต๊ะ ${order.bill.table.number}`;
  }
  if (order.tableId) {
    return `โต๊ะ ${order.tableId}`;
  }
  return order.orderName || `#${order.id}`;
}

export default function KitchenQueue({ type }: { type: "food" | "drink" }) {
  const { data: allOrders, mutate } = useSWR<OrderWithItems[]>(
    "/api/orders?status=active",
    fetcher,
    { refreshInterval: 8000 }
  );

  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const prevCountRef = useRef(0);

  const queueOrders = (allOrders ?? [])
    .filter((o) => isReadyForKitchen(o) && !o.kitchenServedAt)
    .map((order) => {
      const relevantItems = order.items.filter((item) =>
        type === "drink"
          ? DRINK_CATEGORIES.includes(item.menuItem.category)
          : !DRINK_CATEGORIES.includes(item.menuItem.category)
      );
      return { ...order, relevantItems };
    })
    .filter((o) => o.relevantItems.length > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Flash tab title when new orders arrive
  useEffect(() => {
    if (queueOrders.length > prevCountRef.current && prevCountRef.current !== 0) {
      document.title = `🔔 ออเดอร์ใหม่! (${queueOrders.length})`;
      const t = setTimeout(() => {
        document.title = type === "food" ? "🍳 คิวครัว" : "🥤 คิวบาร์";
      }, 5000);
      return () => clearTimeout(t);
    }
    prevCountRef.current = queueOrders.length;
  }, [queueOrders.length, type]);

  async function markDone(orderId: number) {
    if (loadingIds.has(orderId)) return;
    setLoadingIds((prev) => { const s = new Set(prev); s.add(orderId); return s; });
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitchenDone: true }),
      });
      if (res.ok) playDoneChime();
      await mutate();
    } finally {
      setLoadingIds((prev) => { const s = new Set(prev); s.delete(orderId); return s; });
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

  if (queueOrders.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-6xl mb-4">{type === "drink" ? "🥤" : "🍳"}</div>
          <p className="text-xl font-bold text-gray-400">ไม่มีออเดอร์ในคิว</p>
          <p className="text-sm text-gray-300 mt-1">รีเฟรชทุก 8 วินาที</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {queueOrders.map((order, idx) => {
        const isLoading = loadingIds.has(order.id);
        const isFirst = idx === 0;
        const isTab = order.status === "CONFIRMED";
        return (
          <div
            key={order.id}
            className={`rounded-2xl shadow flex flex-col overflow-hidden transition-all ${
              isFirst
                ? "ring-4 ring-orange shadow-orange/20 shadow-xl"
                : "bg-white border border-gray-100"
            }`}
          >
            {/* Header bar */}
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
                {isTab && (
                  <span className="text-xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">
                    TAB
                  </span>
                )}
                <ElapsedBadge createdAt={order.createdAt} />
              </div>
            </div>

            {/* Location: bill name + table */}
            <div className={`px-4 py-2 border-b ${isFirst ? "bg-orange/10 border-orange/20" : "bg-gray-50 border-gray-100"}`}>
              <p className={`text-sm font-bold ${isFirst ? "text-orange" : "text-navy"}`}>
                📍 {getLocationLabel(order)}
              </p>
              {order.orderName && order.bill && (
                <p className="text-xs text-gray-400 mt-0.5">👤 {order.orderName}</p>
              )}
            </div>

            {/* Items */}
            <div className="flex-1 px-4 py-3 space-y-2 bg-white">
              {order.relevantItems.map((item) => {
                const addons: { nameTh: string }[] = item.selectedAddons
                  ? JSON.parse(item.selectedAddons)
                  : [];
                const options: { groupName: string; choiceName: string }[] = item.selectedOptions
                  ? JSON.parse(item.selectedOptions)
                  : [];
                const extras = [
                  item.selectedSize ?? "",
                  addons.map((a) => a.nameTh).join(", "),
                  options.map((o) => o.choiceName).join(", "),
                ].filter(Boolean).join(" · ");
                return (
                  <div key={item.id} className="flex items-start justify-between gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-navy text-sm leading-tight">{item.menuItem.nameTh}</p>
                      {extras && <p className="text-xs text-gray-400 mt-0.5">{extras}</p>}
                    </div>
                    <span className="text-2xl font-black text-orange shrink-0">×{item.quantity}</span>
                  </div>
                );
              })}

              {order.note && (
                <p className="text-xs text-orange bg-orange/10 rounded-lg px-3 py-2">
                  📝 {order.note}
                </p>
              )}
            </div>

            {/* Done button */}
            <div className="px-4 pb-4 pt-2 bg-white">
              <button
                onClick={() => markDone(order.id)}
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
