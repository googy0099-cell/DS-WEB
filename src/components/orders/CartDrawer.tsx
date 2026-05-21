"use client";

import { ShoppingCart, X, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ThaiPrice from "@/components/shared/ThaiPrice";
import { useOrderStore } from "@/store/orderStore";

export default function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();
  const { cart, orderName, userId, total, removeItem, clearCart, setOrderName, setUserId } =
    useOrderStore();
  const router = useRouter();
  const itemCount = cart.reduce((s, c) => s + c.quantity, 0);

  // sync session → store
  useEffect(() => {
    if (session?.user) {
      setOrderName(session.user.username);
      setUserId(parseInt(session.user.id));
    }
  }, [session, setOrderName, setUserId]);

  const displayName = session?.user ? session.user.username : nameInput;

  async function submitOrder() {
    const finalName = session?.user ? session.user.username : nameInput.trim();
    if (!cart.length) return;
    if (!finalName) {
      alert("กรุณากรอกชื่อก่อนสั่งอาหาร");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderName: finalName,
          userId: session?.user ? parseInt(session.user.id) : null,
          note,
          items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
        }),
      });
      if (!res.ok) throw new Error();
      const order = await res.json();
      clearCart();
      setOpen(false);
      router.push(`/checkout?orderId=${order.id}`);
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating cart button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-4 bg-orange text-white rounded-full p-4 shadow-lg flex items-center gap-2 z-40"
      >
        <ShoppingCart size={22} />
        {itemCount > 0 && (
          <span className="font-bold text-sm">
            {itemCount} | <ThaiPrice amount={total()} />
          </span>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-sand">
          <h2 className="font-bold text-navy text-lg">ตะกร้าสินค้า</h2>
          <button onClick={() => setOpen(false)}>
            <X size={22} className="text-gray-400" />
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
          {/* Name field */}
          <div className="bg-sand/40 rounded-xl p-3">
            <p className="text-xs font-medium text-navy mb-1">ชื่อสำหรับรับอาหาร</p>
            {session?.user ? (
              <p className="font-bold text-navy">{session.user.username}
                <span className="text-xs text-gray-400 ml-2 font-normal">(@{session.user.username})</span>
              </p>
            ) : (
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="กรอกชื่อของคุณ"
                className="w-full bg-white border border-sand rounded-lg px-3 py-2 text-sm focus:border-orange focus:outline-none"
              />
            )}
          </div>

          {cart.length === 0 ? (
            <p className="text-center text-gray-400 py-8">ยังไม่มีรายการ</p>
          ) : (
            cart.map((item) => (
              <div key={item.menuItemId} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-navy text-sm">{item.nameTh}</p>
                  <p className="text-xs text-gray-400">
                    {item.quantity} x <ThaiPrice amount={item.priceTHB} />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ThaiPrice
                    amount={item.priceTHB * item.quantity}
                    className="font-bold text-orange text-sm"
                  />
                  <button onClick={() => removeItem(item.menuItemId)}>
                    <Trash2 size={16} className="text-gray-300" />
                  </button>
                </div>
              </div>
            ))
          )}

          {cart.length > 0 && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="หมายเหตุ (เช่น ไม่ใส่ผัก, เผ็ดน้อย)"
              className="w-full border border-sand rounded-lg p-2 text-sm resize-none h-16 mt-2"
            />
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-4 border-t border-sand">
            <div className="flex justify-between mb-3">
              <span className="font-semibold text-navy">รวมทั้งหมด</span>
              <ThaiPrice amount={total()} className="font-bold text-orange text-lg" />
            </div>
            <button
              onClick={submitOrder}
              disabled={loading}
              className="w-full bg-navy text-cream font-bold py-3 rounded-xl disabled:opacity-50"
            >
              {loading ? "กำลังส่งออเดอร์..." : "ยืนยันการสั่งอาหาร"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
