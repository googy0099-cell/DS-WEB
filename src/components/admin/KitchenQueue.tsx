"use client";

import { useState } from "react";
import useSWR from "swr";
import type { OrderWithItems } from "@/types";

const DRINK_CATEGORIES = ["milktea", "coffee", "soda", "drink"];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function elapsed(createdAt: string) {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (diff < 60) return `${diff} วิ`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m} นาที`;
  return `${Math.floor(m / 60)} ชม. ${m % 60} นาที`;
}

function ElapsedBadge({ createdAt }: { createdAt: string }) {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  const minutes = Math.floor(diff / 60);
  const urgent = minutes >= 10;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${urgent ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}>
      ⏱ {elapsed(createdAt)}
    </span>
  );
}

export default function KitchenQueue({ type }: { type: "food" | "drink" }) {
  const { data: allOrders, mutate } = useSWR<OrderWithItems[]>(
    "/api/orders?status=active",
    fetcher,
    { refreshInterval: 8000 }
  );

  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());

  const paidOrders = (allOrders ?? [])
    .filter((o) => o.status === "PAID")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const queueOrders = paidOrders
    .map((order) => {
      const relevantItems = order.items.filter((item) =>
        type === "drink"
          ? DRINK_CATEGORIES.includes(item.menuItem.category)
          : !DRINK_CATEGORIES.includes(item.menuItem.category)
      );
      return { ...order, relevantItems };
    })
    .filter((o) => o.relevantItems.length > 0);

  async function markDone(orderId: number) {
    if (loadingIds.has(orderId)) return;
    setLoadingIds((prev) => { const s = new Set(prev); s.add(orderId); return s; });
    setDoneIds((prev) => { const s = new Set(prev); s.add(orderId); return s; });
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SERVED" }),
      });
      await mutate();
    } finally {
      setLoadingIds((prev) => { const s = new Set(prev); s.delete(orderId); return s; });
      setDoneIds((prev) => { const s = new Set(prev); s.delete(orderId); return s; });
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
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="text-center">
          <div className="text-5xl mb-3">{type === "drink" ? "🥤" : "🍳"}</div>
          <p className="text-lg font-medium text-gray-500">ไม่มีออเดอร์ในคิว</p>
          <p className="text-sm text-gray-400 mt-1">รีเฟรชทุก 8 วินาที</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {queueOrders.map((order, idx) => {
        const isLoading = loadingIds.has(order.id);
        const justDone = doneIds.has(order.id);
        return (
          <div
            key={order.id}
            className={`bg-white rounded-2xl shadow-sm border-2 flex flex-col transition-all ${
              idx === 0 ? "border-orange shadow-orange/10 shadow-lg" : "border-gray-100"
            }`}
          >
            {/* Queue number header */}
            <div className={`flex items-center justify-between px-4 py-2 rounded-t-2xl ${
              idx === 0 ? "bg-orange text-white" : "bg-navy text-cream"
            }`}>
              <span className="font-black text-xl">#{idx + 1}</span>
              <ElapsedBadge createdAt={order.createdAt} />
            </div>

            {/* Order name */}
            <div className="px-4 pt-3 pb-1">
              <p className="font-bold text-navy text-base truncate">
                {order.orderName || `ออเดอร์ #${order.id}`}
              </p>
            </div>

            {/* Items */}
            <div className="flex-1 px-4 pb-3">
              <div className="space-y-2 mt-1">
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
                    <div key={item.id} className="bg-gray-50 rounded-xl px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold text-navy text-sm leading-tight">
                          {item.menuItem.nameTh}
                        </p>
                        <span className="text-xl font-black text-orange shrink-0">×{item.quantity}</span>
                      </div>
                      {extras && (
                        <p className="text-xs text-gray-400 mt-0.5">{extras}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {order.note && (
                <p className="mt-2 text-xs text-orange bg-orange/10 rounded-lg px-3 py-1.5">
                  📝 {order.note}
                </p>
              )}
            </div>

            {/* Done button */}
            <div className="px-4 pb-4">
              <button
                onClick={() => markDone(order.id)}
                disabled={isLoading || justDone}
                className={`w-full py-3.5 rounded-xl font-bold text-base transition-all disabled:opacity-50 ${
                  justDone
                    ? "bg-gray-200 text-gray-500"
                    : "bg-green-500 hover:bg-green-600 active:scale-95 text-white shadow-sm"
                }`}
              >
                {isLoading ? "กำลังบันทึก..." : justDone ? "✓ เสร็จแล้ว" : "✅ เสร็จแล้ว"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
