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

async function showBrowserNotification(orderName: string, total: number) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const body = `${orderName} • ฿${total}`;
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
  const { data: todayOrders, mutate: mutateTodayOrders } = useSWR<OrderWithItems[]>(
    "/api/orders?status=today",
    fetcher,
    { refreshInterval: 30000 }
  );

  const prevIdsRef = useRef<Set<number>>(new Set());
  const alertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // Loading state per order (prevents double-click)
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());

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

  const pendingOrders = orders?.filter((o) => o.status === "PENDING") ?? [];

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
      try {
        playBeep(getCtx());
      } catch {}
      alertIntervalRef.current = setInterval(() => {
        try {
          playBeep(getCtx());
        } catch {}
      }, 3000);
    }
    return () => {
      if (alertIntervalRef.current) {
        clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    };
  }, [pendingOrders.length, alertEnabled]);

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

  async function deleteOrder(orderId: number) {
    if (!window.confirm("ลบออเดอร์นี้ถาวร?")) return;
    setLoading(orderId, true);
    try {
      await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      await Promise.all([mutate(), mutateTodayOrders()]);
    } finally {
      setLoading(orderId, false);
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

  const activeOrders = orders?.filter((o) => o.status !== "PENDING") ?? [];

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
            {alertEnabled && pendingOrders.length > 0 && (
              <p className="text-xs text-red-500 font-medium animate-pulse">
                กำลังดัง — กด "รับออเดอร์แล้ว" เพื่อหยุด
              </p>
            )}
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
                onUpdate={updateStatus}
                onEdit={openEdit}
                onDelete={deleteOrder}
              />
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
              <OrderCard
                key={order.id}
                order={order}
                isNew={false}
                isLoading={loadingIds.has(order.id)}
                onUpdate={updateStatus}
                onEdit={openEdit}
                onDelete={deleteOrder}
              />
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
                  {/* Delete from history */}
                  <button
                    onClick={() => deleteOrder(order.id)}
                    disabled={loadingIds.has(order.id)}
                    className="mt-2 text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                  >
                    🗑️ ลบ
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

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

function OrderCard({
  order,
  isNew,
  isLoading,
  onUpdate,
  onEdit,
  onDelete,
}: {
  order: OrderWithItems;
  isNew: boolean;
  isLoading: boolean;
  onUpdate: (id: number, status: string) => void;
  onEdit: (order: OrderWithItems) => void;
  onDelete: (id: number) => void;
}) {
  const cfg = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING;
  const canCancel = order.status === "PENDING" || order.status === "CONFIRMED";
  const canEdit = order.status === "PENDING" || order.status === "CONFIRMED" || order.status === "PAID";

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border-2 transition-all ${
        isNew ? "border-yellow-400 shadow-yellow-100 shadow-lg" : "border-transparent"
      }`}
    >
      {isNew && (
        <div className="bg-yellow-400 text-white text-xs font-bold text-center py-1 rounded-t-xl animate-pulse">
          🔔 ออเดอร์ใหม่! กรุณารับออเดอร์
        </div>
      )}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-bold text-navy text-lg">
              👤 {order.orderName || `ออเดอร์ #${order.id}`}
            </p>
            <p className="text-xs text-gray-400">{formatThaiDateTime(order.createdAt)}</p>
          </div>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${cfg.color}`}>
            {cfg.label}
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
            return (
              <div key={item.id} className="flex justify-between text-sm gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-gray-800 font-medium">{item.menuItem.nameTh}</span>
                  {item.selectedSize && (
                    <span className="ml-1 text-xs bg-orange/10 text-orange px-1.5 py-0.5 rounded-full">
                      {item.selectedSize}
                    </span>
                  )}
                  <span className="text-gray-400 font-normal"> ×{item.quantity}</span>
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

        {/* Primary action */}
        {cfg.next && (
          <button
            onClick={() => onUpdate(order.id, cfg.next!)}
            disabled={isLoading}
            className={`w-full text-sm font-bold py-3 rounded-xl mb-2 transition-opacity disabled:opacity-60 ${cfg.nextColor}`}
          >
            {isLoading ? "กำลังบันทึก..." : cfg.nextLabel}
          </button>
        )}

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
