"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { formatThaiDateTime } from "@/lib/thai-datetime";
import type { OrderWithItems } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
    label: "✅ ชำระแล้ว",
    color: "bg-green-100 text-green-800 border-green-300",
    next: "SERVED",
    nextLabel: "🖥️ คีย์ลง Wongnai แล้ว",
    nextColor: "bg-orange text-white",
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

function playBeep(ctx: AudioContext) {
  const now = ctx.currentTime;
  // 4 beeps ถี่ๆ แบบกระตุ้น
  const pattern = [0, 0.15, 0.3, 0.45];
  pattern.forEach((t) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square"; // เสียงแหลมกว่า sine
    osc.frequency.setValueAtTime(1050, now + t);
    osc.frequency.setValueAtTime(780, now + t + 0.06);
    gain.gain.setValueAtTime(0.6, now + t);
    gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.12);
    osc.start(now + t);
    osc.stop(now + t + 0.12);
  });
}

async function showBrowserNotification(orderName: string, total: number) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const body = `${orderName} • ฿${total}`;
  // ใช้ service worker เพื่อให้แจ้งเตือนได้แม้ไม่ได้อยู่ในแท็บ
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
    { refreshInterval: 8000 }
  );
  const { data: todayOrders } = useSWR<OrderWithItems[]>(
    "/api/orders?status=today",
    fetcher,
    { refreshInterval: 30000 }
  );

  const prevIdsRef = useRef<Set<number>>(new Set());
  const alertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // request notification permission + subscribe Web Push
  useEffect(() => {
    async function setupPush() {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
      const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== "granted") return;

      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (!reg) return;

      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      }).catch(() => null);

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

  const pendingOrders = orders?.filter((o) => o.status === "PENDING") ?? [];

  // เริ่ม/หยุด interval เสียงตามจำนวน PENDING
  // ทำงานทันทีที่มี PENDING ไม่ว่าจะ refresh หรือออเดอร์ใหม่เข้า
  useEffect(() => {
    const getCtx = () => {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      return audioCtxRef.current;
    };

    if (!alertEnabled || pendingOrders.length === 0) {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
      return;
    }

    if (!alertIntervalRef.current) {
      try { playBeep(getCtx()); } catch {}
      alertIntervalRef.current = setInterval(() => {
        try { playBeep(getCtx()); } catch {}
      }, 3000);
    }

    return () => {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    };
  }, [pendingOrders.length, alertEnabled]);

  // ตรวจ pending ใหม่ → browser notification
  useEffect(() => {
    if (!orders) return;
    const incoming = orders.filter(
      (o) => o.status === "PENDING" && !prevIdsRef.current.has(o.id)
    );
    incoming.forEach((o) =>
      showBrowserNotification(o.orderName || `ออเดอร์ #${o.id}`, o.totalTHB)
    );
    prevIdsRef.current = new Set(orders.map((o) => o.id));
  }, [orders]);

  async function updateStatus(orderId: number, status: string) {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    mutate();
  }

  const activeOrders = orders?.filter((o) => o.status !== "PENDING") ?? [];

  if (!orders) return <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>;

  return (
    <div className="space-y-6">
      {/* Alert toggle */}
      <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">{alertEnabled ? "🔔" : "🔕"}</span>
          <div>
            <p className="text-sm font-medium text-navy">เสียงแจ้งเตือนออเดอร์ใหม่</p>
            {alertEnabled && pendingOrders.length > 0 && (
              <p className="text-xs text-red-500 font-medium animate-pulse">กำลังดัง — กด "รับออเดอร์แล้ว" เพื่อหยุด</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setAlertEnabled((v) => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors ${alertEnabled ? "bg-orange" : "bg-gray-300"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${alertEnabled ? "left-5" : "left-0.5"}`} />
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
              <OrderCard key={order.id} order={order} isNew onUpdate={updateStatus} />
            ))}
          </div>
        </div>
      )}

      {/* ออเดอร์กำลังดำเนินการ */}
      {activeOrders.length > 0 && (
        <div>
          <h3 className="font-bold text-navy mb-3">กำลังดำเนินการ</h3>
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <OrderCard key={order.id} order={order} isNew={false} onUpdate={updateStatus} />
            ))}
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
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.color ?? "bg-gray-100 text-gray-500"}`}>
                      {STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.label ?? order.status}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 space-y-1">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-xs text-gray-600">
                        <span>{item.menuItem.nameTh} ×{item.quantity}</span>
                        <span>฿{item.unitPriceTHB * item.quantity}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 pt-1 flex justify-between text-sm font-bold text-navy">
                      <span>รวม</span>
                      <span>฿{order.totalTHB}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  isNew,
  onUpdate,
}: {
  order: OrderWithItems;
  isNew: boolean;
  onUpdate: (id: number, status: string) => void;
}) {
  const cfg = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING;

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 transition-all ${isNew ? "border-yellow-400 shadow-yellow-100 shadow-lg" : "border-transparent"}`}>
      {isNew && (
        <div className="bg-yellow-400 text-white text-xs font-bold text-center py-1 rounded-t-xl animate-pulse">
          🔔 ออเดอร์ใหม่! กรุณารับออเดอร์
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-bold text-navy text-lg">👤 {order.orderName || `ออเดอร์ #${order.id}`}</p>
            <p className="text-xs text-gray-400">{formatThaiDateTime(order.createdAt)}</p>
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-2">
          {order.items.map((item) => {
            const addons: { nameTh: string }[] = item.selectedAddons ? JSON.parse(item.selectedAddons) : [];
            const options: { groupName: string; choiceName: string }[] = item.selectedOptions ? JSON.parse(item.selectedOptions) : [];
            return (
              <div key={item.id} className="flex justify-between text-sm gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-gray-800 font-medium">{item.menuItem.nameTh}</span>
                  {item.selectedSize && (
                    <span className="ml-1 text-xs bg-orange/10 text-orange px-1.5 py-0.5 rounded-full">{item.selectedSize}</span>
                  )}
                  <span className="text-gray-400 font-normal"> ×{item.quantity}</span>
                  {addons.length > 0 && (
                    <p className="text-xs text-gray-400">+ {addons.map((a) => a.nameTh).join(", ")}</p>
                  )}
                  {options.length > 0 && (
                    <p className="text-xs text-gray-400">{options.map((o) => `${o.groupName}: ${o.choiceName}`).join(", ")}</p>
                  )}
                </div>
                <span className="text-navy font-semibold shrink-0">฿{item.unitPriceTHB * item.quantity}</span>
              </div>
            );
          })}
          <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-navy">
            <span>รวม</span>
            <span>฿{order.totalTHB}</span>
          </div>
        </div>

        {order.note && (
          <p className="mb-3 text-xs text-orange bg-orange/10 rounded-lg px-3 py-1.5">
            📝 หมายเหตุ: {order.note}
          </p>
        )}

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

        <div className="flex gap-2">
          {cfg.next && (
            <button
              onClick={() => onUpdate(order.id, cfg.next!)}
              className={`flex-1 text-sm font-bold py-2.5 rounded-xl ${cfg.nextColor}`}
            >
              {cfg.nextLabel}
            </button>
          )}
          {order.status === "PENDING" && (
            <button
              onClick={() => onUpdate(order.id, "CANCELLED")}
              className="bg-red-50 text-red-600 text-sm font-medium px-3 py-2.5 rounded-xl"
            >
              ยกเลิก
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
