"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

const TIME_ELIGIBLE = ["coffee", "milktea", "soda"];
const CAT_LABELS: Record<string, string> = {
  milktea: "Milk & Tea", coffee: "Coffee", soda: "Soda Zaa",
  drink: "เครื่องดื่ม", food: "อาหาร", snack: "ของว่าง", dessert: "ของหวาน",
};
const ALL_CATS = ["milktea", "coffee", "soda", "drink", "food", "snack", "dessert"];

type MenuItem = {
  id: number; nameTh: string; nameEn: string; category: string;
  priceTHB: number; priceS: number | null; priceXL: number | null; imageUrl: string | null;
  isAvailable: boolean;
};
type PlayerSession = { id: number; nickname: string; timeRemaining: number; updatedAt: string };

type CartItem = {
  menuItem: MenuItem;
  quantity: number;
  size: "S" | "M" | "XL" | null;
  forSessionId: number;
};

function fmt(secs: number) {
  if (secs >= 86400) return "∞";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function PosMenuPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const router = useRouter();

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<PlayerSession[]>([]);
  const [mySession, setMySession] = useState<PlayerSession | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCat, setActiveCat] = useState("milktea");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [orderTarget, setOrderTarget] = useState<number | null>(null);
  const [addModal, setAddModal] = useState<MenuItem | null>(null);
  const [addSize, setAddSize] = useState<"S" | "M" | "XL" | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeDisplay, setTimeDisplay] = useState(0);

  useEffect(() => {
    const id = sessionStorage.getItem("pos_sessionId");
    if (!id) { router.replace(`/pos/${tableId}`); return; }
    setSessionId(Number(id));
    setOrderTarget(Number(id));
  }, [tableId, router]);

  const loadData = useCallback(async () => {
    if (!sessionId) return;
    const [menuRes, sessRes, myRes] = await Promise.all([
      fetch("/api/menu"),
      fetch(`/api/pos/sessions?tableId=${tableId}`),
      fetch(`/api/pos/sessions/${sessionId}`),
    ]);
    if (menuRes.ok) setMenuItems(await menuRes.json());
    if (sessRes.ok) setSessions(await sessRes.json());
    if (myRes.ok) {
      const data = await myRes.json();
      setMySession(data);
      setTimeDisplay(data.timeRemaining);
    }
  }, [sessionId, tableId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Countdown
  useEffect(() => {
    const interval = setInterval(() => setTimeDisplay((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, []);

  const cats = ALL_CATS.filter((c) => menuItems.some((m) => m.category === c));
  const displayed = menuItems.filter((m) => m.category === activeCat && m.isAvailable);

  function openAddModal(item: MenuItem) {
    setAddModal(item);
    setAddSize(item.priceS ? "M" : null);
  }

  function addToCart() {
    if (!addModal || !orderTarget) return;
    const session = sessions.find((s) => s.id === orderTarget) ?? mySession;
    if (!session) return;
    setCart((prev) => {
      const existing = prev.findIndex((c) => c.menuItem.id === addModal.id && c.forSessionId === orderTarget && c.size === addSize);
      if (existing >= 0) {
        const next = [...prev];
        next[existing].quantity += 1;
        return next;
      }
      return [...prev, { menuItem: addModal, quantity: 1, size: addSize, forSessionId: orderTarget }];
    });
    setAddModal(null);
  }

  function itemPrice(item: CartItem) {
    if (item.size === "S" && item.menuItem.priceS) return item.menuItem.priceS;
    if (item.size === "XL" && item.menuItem.priceXL) return item.menuItem.priceXL;
    return item.menuItem.priceTHB;
  }

  const cartTotal = cart.reduce((sum, c) => sum + itemPrice(c) * c.quantity, 0);

  async function submitOrder() {
    if (!cart.length || !sessionId) return;
    setSubmitting(true);

    const grouped = new Map<number, CartItem[]>();
    for (const item of cart) {
      if (!grouped.has(item.forSessionId)) grouped.set(item.forSessionId, []);
      grouped.get(item.forSessionId)!.push(item);
    }

    for (const [sid, items] of grouped) {
      await fetch("/api/pos/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          items: items.map((i) => ({
            menuItemId: i.menuItem.id,
            quantity: i.quantity,
            selectedSize: i.size,
          })),
        }),
      });
    }

    setCart([]);
    setShowCart(false);
    setSubmitting(false);
    setOrderSuccess(true);
    loadData();
    setTimeout(() => setOrderSuccess(false), 3000);
  }

  const timeColor = timeDisplay > 600 ? "text-green-400" : timeDisplay > 0 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-cream pb-32">
      {/* Header */}
      <div className="bg-navy sticky top-0 z-40 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">{mySession?.nickname ?? "..."} — โต๊ะ {tableId}</p>
            <p className={`text-xs font-mono font-bold ${timeColor}`}>⏱ {fmt(timeDisplay)}</p>
          </div>
          <button
            onClick={() => setShowCart(true)}
            className="relative bg-orange text-white font-bold px-4 py-2 rounded-xl text-sm"
          >
            🛒 ตะกร้า
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cart.reduce((s, c) => s + c.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Success banner */}
      {orderSuccess && (
        <div className="bg-green-500 text-white text-center py-2.5 font-semibold text-sm">
          ✅ สั่งอาหารเรียบร้อยแล้ว!
        </div>
      )}

      {/* Category tabs */}
      <div className="sticky top-[56px] z-30 bg-white border-b border-sand overflow-x-auto">
        <div className="flex gap-1 px-4 py-2 max-w-2xl mx-auto">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeCat === c ? "bg-orange text-white" : "bg-sand/50 text-navy hover:bg-sand"
              }`}
            >
              {TIME_ELIGIBLE.includes(c) && "⏰ "}{CAT_LABELS[c] ?? c}
            </button>
          ))}
        </div>
      </div>

      {/* Badge info */}
      {TIME_ELIGIBLE.includes(activeCat) && (
        <div className="bg-orange/10 border-b border-orange/20 text-orange text-xs text-center py-2 font-semibold">
          ⏰ เมนูหมวดนี้ทุกแก้ว = +1 ชั่วโมงเล่นฟรี!
        </div>
      )}

      {/* Menu grid */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          {displayed.map((item) => (
            <button
              key={item.id}
              onClick={() => openAddModal(item)}
              className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md text-left transition-all active:scale-95"
            >
              {item.imageUrl ? (
                <div className="relative aspect-square w-full">
                  <Image src={item.imageUrl} alt={item.nameTh} fill className="object-cover" />
                </div>
              ) : (
                <div className="aspect-square bg-sand flex items-center justify-center">
                  <span className="text-4xl">🍽️</span>
                </div>
              )}
              <div className="p-2.5">
                {TIME_ELIGIBLE.includes(item.category) && (
                  <span className="inline-block bg-orange/15 text-orange text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-1">
                    +1 ชม.
                  </span>
                )}
                <p className="font-semibold text-navy text-xs leading-tight">{item.nameTh}</p>
                <p className="text-orange font-bold text-sm mt-0.5">
                  {item.priceS ? `฿${item.priceS}` : `฿${item.priceTHB}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Add to cart modal */}
      {addModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={() => setAddModal(null)}>
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-3 items-start">
              {addModal.imageUrl && (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                  <Image src={addModal.imageUrl} alt={addModal.nameTh} fill className="object-cover" />
                </div>
              )}
              <div>
                <p className="font-bold text-navy">{addModal.nameTh}</p>
                {TIME_ELIGIBLE.includes(addModal.category) && (
                  <span className="text-xs bg-orange/15 text-orange px-2 py-0.5 rounded-full font-bold">+1 ชม. เล่นฟรี</span>
                )}
              </div>
            </div>

            {(addModal.priceS || addModal.priceXL) && (
              <div>
                <p className="text-xs font-semibold text-navy mb-1.5">ขนาด</p>
                <div className="flex gap-2">
                  {[
                    { key: "S", price: addModal.priceS, label: "S" },
                    { key: "M", price: addModal.priceTHB, label: "M" },
                    addModal.priceXL ? { key: "XL", price: addModal.priceXL, label: "XL" } : null,
                  ].filter(Boolean).map((sz) => (
                    <button
                      key={sz!.key}
                      onClick={() => setAddSize(sz!.key as "S" | "M" | "XL")}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                        addSize === sz!.key ? "border-orange bg-orange/10 text-navy" : "border-sand text-gray-500"
                      }`}
                    >
                      {sz!.label} — ฿{sz!.price}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-navy mb-1.5">สั่งเป็นของ</p>
              <div className="flex flex-wrap gap-2">
                {[...sessions.filter(s => s.id !== sessionId), ...(mySession ? [mySession] : [])].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setOrderTarget(s.id)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      orderTarget === s.id ? "border-orange bg-orange/10 text-navy" : "border-sand text-gray-500"
                    }`}
                  >
                    {s.id === sessionId ? `${s.nickname} (ฉัน)` : s.nickname}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={addToCart}
              className="w-full bg-orange text-white font-bold py-3.5 rounded-2xl"
            >
              เพิ่มลงตะกร้า
            </button>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowCart(false)}>
          <div className="bg-white rounded-t-3xl p-5 w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-navy text-lg mb-4">ตะกร้าสินค้า</h3>

            {cart.length === 0 ? (
              <p className="text-center text-gray-400 py-8">ยังไม่มีรายการ</p>
            ) : (
              <div className="space-y-2 mb-4">
                {cart.map((c, i) => {
                  const owner = sessions.find((s) => s.id === c.forSessionId) ?? mySession;
                  return (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-sand">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-navy">{c.menuItem.nameTh} {c.size ? `(${c.size})` : ""}</p>
                        <p className="text-xs text-gray-400">ของ: {owner?.nickname}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCart((prev) => prev.map((x, idx) => idx === i ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))} className="w-7 h-7 bg-sand rounded-lg text-navy font-bold flex items-center justify-center">−</button>
                        <span className="text-sm font-bold w-4 text-center">{c.quantity}</span>
                        <button onClick={() => setCart((prev) => prev.map((x, idx) => idx === i ? { ...x, quantity: x.quantity + 1 } : x))} className="w-7 h-7 bg-sand rounded-lg text-navy font-bold flex items-center justify-center">+</button>
                      </div>
                      <p className="text-sm font-bold text-orange w-16 text-right">฿{itemPrice(c) * c.quantity}</p>
                      <button onClick={() => setCart((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-400 text-xs">🗑</button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between py-3 border-t border-sand">
              <span className="font-bold text-navy">รวม</span>
              <span className="font-bold text-orange text-xl">฿{cartTotal}</span>
            </div>

            <button
              onClick={submitOrder}
              disabled={!cart.length || submitting}
              className="w-full bg-orange text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40"
            >
              {submitting ? "กำลังส่ง..." : `สั่งอาหาร ฿${cartTotal}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
