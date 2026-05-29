"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1];

interface MenuItem {
  id: number;
  nameTh: string;
  nameEn: string;
  priceTHB: number;
  priceS: number | null;
  priceXL: number | null;
  category: string;
  isAvailable: boolean;
}

interface CartEntry {
  menuItemId: number;
  nameTh: string;
  priceTHB: number;
  selectedSize: "S" | "XL" | null;
  qty: number;
}

interface Payment {
  id: number;
  method: string;
  amountTHB: number;
  receivedAmount: number | null;
  changeAmount: number | null;
  confirmedAt: string;
  order: { id: number; orderName: string; totalTHB: number };
}

interface LastClose {
  id: number;
  date: string;
  openingFloat: number;
  expectedCash: number;
  totalTransfer: number;
  countedCash: number;
  difference: number;
  note: string | null;
  createdAt: string;
}

interface Summary {
  date: string;
  cashTotal: number;
  transferTotal: number;
  cashPayments: Payment[];
  transferPayments: Payment[];
  lastClose: LastClose | null;
}

function formatThaiDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const bkk = new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60_000);
  return `${String(bkk.getHours()).padStart(2, "0")}:${String(bkk.getMinutes()).padStart(2, "0")}`;
}

export default function CashierPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  // Order modal state
  const [orderModal, setOrderModal] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [orderName, setOrderName] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [orderSaving, setOrderSaving] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");

  const loadMenu = useCallback(async () => {
    const res = await fetch("/api/menu").then((r) => r.json()).catch(() => []);
    const items = Array.isArray(res) ? (res as MenuItem[]) : [];
    setMenuItems(items.filter((m) => m.isAvailable && m.category !== "gametime"));
  }, []);

  function addToCart(item: MenuItem, size: "S" | "XL" | null) {
    const price = size === "S" ? (item.priceS ?? item.priceTHB) : size === "XL" ? (item.priceXL ?? item.priceTHB) : item.priceTHB;
    const key = `${item.id}-${size ?? ""}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id && c.selectedSize === size);
      if (existing) return prev.map((c) => c.menuItemId === item.id && c.selectedSize === size ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { menuItemId: item.id, nameTh: item.nameTh + (size ? ` (${size})` : ""), priceTHB: price, selectedSize: size, qty: 1 }];
    });
  }

  function changeCartQty(idx: number, delta: number) {
    setCart((prev) => {
      const updated = prev.map((c, i) => i === idx ? { ...c, qty: c.qty + delta } : c);
      return updated.filter((c) => c.qty > 0);
    });
  }

  const cartTotal = cart.reduce((s, c) => s + c.priceTHB * c.qty, 0);

  async function submitOrder() {
    if (!orderName.trim() || cart.length === 0) return;
    setOrderSaving(true);
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderName: orderName.trim(),
        items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.qty, selectedSize: c.selectedSize })),
        note: orderNote.trim() || undefined,
        source: "cashier",
      }),
    });
    setOrderSaving(false);
    setOrderModal(false);
    setCart([]);
    setOrderName("");
    setOrderNote("");
    setMenuSearch("");
  }

  const filteredMenu = menuItems.filter((m) =>
    !menuSearch || m.nameTh.includes(menuSearch) || m.nameEn.toLowerCase().includes(menuSearch.toLowerCase())
  );
  const menuCategories = [...new Set(filteredMenu.map((m) => m.category))];

  const [openingFloat, setOpeningFloat] = useState("0");
  const [counts, setCounts] = useState<Record<number, string>>(
    Object.fromEntries(DENOMINATIONS.map((d) => [d, ""]))
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/cashier/summary")
      .then((r) => r.json())
      .then((d: Summary) => { setSummary(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const countedCash = DENOMINATIONS.reduce((s, d) => s + d * (parseInt(counts[d]) || 0), 0);
  const floatNum = parseInt(openingFloat) || 0;
  const expectedCash = floatNum + (summary?.cashTotal ?? 0);
  const difference = countedCash - expectedCash;

  async function handleClose() {
    if (!confirm("ปิดยอดประจำวันนี้?")) return;
    setSaving(true);
    const res = await fetch("/api/cashier/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingFloat: floatNum, countedCash, note }),
    });
    if (res.ok) {
      setSaved(true);
      const updated = await fetch("/api/cashier/summary").then((r) => r.json());
      setSummary(updated);
    }
    setSaving(false);
  }

  if (loading) return <div className="text-center py-16 text-gray-400">กำลังโหลด...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-navy">เก๊ะเงิน</h1>
        <div className="flex items-center gap-2">
          {summary && <span className="text-sm text-gray-400">{formatThaiDate(summary.date)}</span>}
          <button
            onClick={() => { setOrderModal(true); loadMenu(); }}
            className="bg-orange text-white text-sm font-bold px-4 py-2 rounded-xl">
            🛒 สั่งอาหาร
          </button>
        </div>
      </div>

      {/* Daily summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-green-600 font-semibold mb-1">เงินสดวันนี้</p>
          <p className="text-3xl font-bold text-green-700">฿{(summary?.cashTotal ?? 0).toLocaleString()}</p>
          <p className="text-xs text-green-500 mt-1">{summary?.cashPayments.length ?? 0} รายการ</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-blue-600 font-semibold mb-1">โอนเงิน/QR วันนี้</p>
          <p className="text-3xl font-bold text-blue-700">฿{(summary?.transferTotal ?? 0).toLocaleString()}</p>
          <p className="text-xs text-blue-500 mt-1">{summary?.transferPayments.length ?? 0} รายการ</p>
        </div>
      </div>

      {/* Cash payment list */}
      {(summary?.cashPayments.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-sand">
            <p className="text-sm font-bold text-navy">รายการเงินสด</p>
          </div>
          <div className="divide-y divide-sand/50">
            {summary!.cashPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-navy">{p.order.orderName}</p>
                  <p className="text-xs text-gray-400">{formatTime(p.confirmedAt)} น.</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-700">฿{p.amountTHB.toLocaleString()}</p>
                  {p.receivedAmount != null && p.changeAmount != null && (
                    <p className="text-xs text-gray-400">รับ ฿{p.receivedAmount.toLocaleString()} ทอน ฿{p.changeAmount.toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last close record */}
      {summary?.lastClose && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-yellow-700 mb-2">ปิดยอดล่าสุดวันนี้</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-gray-500">เงินเปิดเก๊ะ</span><span className="font-semibold text-navy">฿{summary.lastClose.openingFloat.toLocaleString()}</span>
            <span className="text-gray-500">เงินสดคาดหวัง</span><span className="font-semibold text-navy">฿{(summary.lastClose.openingFloat + summary.lastClose.expectedCash).toLocaleString()}</span>
            <span className="text-gray-500">นับได้จริง</span><span className="font-semibold text-navy">฿{summary.lastClose.countedCash.toLocaleString()}</span>
            <span className="text-gray-500">ขาด/เกิน</span>
            <span className={`font-bold ${summary.lastClose.difference === 0 ? "text-green-600" : summary.lastClose.difference > 0 ? "text-blue-600" : "text-red-600"}`}>
              {summary.lastClose.difference > 0 ? "+" : ""}{summary.lastClose.difference.toLocaleString()} บาท
            </span>
          </div>
          {summary.lastClose.note && <p className="text-xs text-gray-400 mt-2">หมายเหตุ: {summary.lastClose.note}</p>}
        </div>
      )}

      {/* Cash count form */}
      {!saved && (
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <p className="text-sm font-bold text-navy">นับเงินในเก๊ะ</p>

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 w-28 shrink-0">เงินเปิดเก๊ะ (฿)</label>
            <input
              type="number"
              inputMode="numeric"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm text-center font-semibold focus:outline-none focus:border-orange"
            />
          </div>

          <div className="border-t border-sand pt-3">
            <p className="text-xs text-gray-400 mb-3">นับธนบัตร/เหรียญ</p>
            <div className="space-y-2">
              {DENOMINATIONS.map((d) => {
                const subtotal = d * (parseInt(counts[d]) || 0);
                return (
                  <div key={d} className="flex items-center gap-2">
                    <span className="w-14 text-right text-sm font-semibold text-navy shrink-0">฿{d}</span>
                    <span className="text-gray-400 text-sm shrink-0">×</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={counts[d]}
                      onChange={(e) => setCounts((prev) => ({ ...prev, [d]: e.target.value }))}
                      placeholder="0"
                      className="w-20 border border-sand rounded-xl px-2 py-1.5 text-sm text-center focus:outline-none focus:border-orange"
                    />
                    <span className="text-gray-400 text-sm shrink-0">=</span>
                    <span className="flex-1 text-right text-sm font-semibold text-navy">฿{subtotal.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-sand pt-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">รวมที่นับได้</span>
              <span className="text-xl font-bold text-navy">฿{countedCash.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">คาดหวัง (เปิดเก๊ะ + เงินสดวันนี้)</span>
              <span className="text-sm font-semibold text-gray-500">฿{expectedCash.toLocaleString()}</span>
            </div>
            <div className={`flex justify-between items-center rounded-xl px-3 py-2 ${difference === 0 ? "bg-green-50" : difference > 0 ? "bg-blue-50" : "bg-red-50"}`}>
              <span className="text-sm font-bold">ขาด/เกิน</span>
              <span className={`text-xl font-bold ${difference === 0 ? "text-green-600" : difference > 0 ? "text-blue-600" : "text-red-600"}`}>
                {difference > 0 ? "+" : ""}{difference.toLocaleString()} บาท
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-navy block mb-1">หมายเหตุ (ถ้ามี)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange resize-none"
              placeholder="เช่น เงินเกินเนื่องจาก..."
            />
          </div>

          <div className="bg-sand/40 rounded-xl p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">เงินสดวันนี้</span><span className="font-semibold">฿{(summary?.cashTotal ?? 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">โอนเงิน/QR</span><span className="font-semibold">฿{(summary?.transferTotal ?? 0).toLocaleString()}</span></div>
            <div className="flex justify-between border-t border-sand/50 pt-1"><span className="font-bold text-navy">รวมทั้งหมด</span><span className="font-bold text-orange text-base">฿{((summary?.cashTotal ?? 0) + (summary?.transferTotal ?? 0)).toLocaleString()}</span></div>
          </div>

          <button
            onClick={handleClose}
            disabled={saving}
            className="w-full bg-navy text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "ปิดยอดประจำวัน"}
          </button>
        </div>
      )}

      {saved && (
        <div className="text-center py-8 space-y-2">
          <p className="text-4xl">✅</p>
          <p className="font-bold text-navy">ปิดยอดเรียบร้อย</p>
          <button onClick={() => { setSaved(false); setCounts(Object.fromEntries(DENOMINATIONS.map((d) => [d, ""]))); setNote(""); }}
            className="text-sm text-orange underline">ปิดยอดใหม่อีกครั้ง</button>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/admin" className="text-sm text-gray-400 hover:text-navy">← กลับ Dashboard</Link>
      </div>

      {/* Order modal */}
      {orderModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sand shrink-0">
              <h3 className="font-bold text-navy text-lg">🛒 สั่งอาหาร (แคชเชียร์)</h3>
              <button onClick={() => setOrderModal(false)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Customer name */}
              <div>
                <label className="text-xs font-semibold text-navy block mb-1">ชื่อลูกค้า *</label>
                <input value={orderName} onChange={(e) => setOrderName(e.target.value)}
                  placeholder="เช่น คุณสมชาย หรือ โต๊ะ 3"
                  className="w-full border-2 border-sand rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange" />
              </div>

              {/* Search */}
              <input value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)}
                placeholder="🔍 ค้นหารายการ..."
                className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />

              {/* Menu list */}
              {menuCategories.map((cat) => (
                <div key={cat}>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">{cat}</p>
                  <div className="space-y-1">
                    {filteredMenu.filter((m) => m.category === cat).map((item) => {
                      const hasSizes = item.priceS != null || item.priceXL != null;
                      if (hasSizes) {
                        return (
                          <div key={item.id} className="flex items-center justify-between gap-2 py-1">
                            <span className="text-sm text-navy flex-1">{item.nameTh}</span>
                            <div className="flex gap-1 shrink-0">
                              {item.priceS != null && (
                                <button onClick={() => addToCart(item, "S")}
                                  className="text-xs bg-orange/10 text-orange border border-orange/30 px-2 py-1 rounded-lg font-semibold">
                                  S ฿{item.priceS}
                                </button>
                              )}
                              {item.priceXL != null && (
                                <button onClick={() => addToCart(item, "XL")}
                                  className="text-xs bg-orange/10 text-orange border border-orange/30 px-2 py-1 rounded-lg font-semibold">
                                  XL ฿{item.priceXL}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-2 py-1">
                          <span className="text-sm text-navy flex-1">{item.nameTh}</span>
                          <button onClick={() => addToCart(item, null)}
                            className="text-xs bg-orange/10 text-orange border border-orange/30 px-3 py-1 rounded-lg font-semibold shrink-0">
                            ฿{item.priceTHB} +
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Cart + submit */}
            <div className="border-t border-sand p-4 space-y-3 shrink-0 bg-white">
              {cart.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {cart.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 text-navy truncate">{c.nameTh}</span>
                      <span className="text-gray-400 shrink-0">฿{c.priceTHB}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => changeCartQty(i, -1)} className="w-6 h-6 rounded-full bg-sand text-navy font-bold flex items-center justify-center">−</button>
                        <span className="w-5 text-center font-bold text-navy">{c.qty}</span>
                        <button onClick={() => changeCartQty(i, 1)} className="w-6 h-6 rounded-full bg-orange text-white font-bold flex items-center justify-center">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">หมายเหตุ</label>
                <input value={orderNote} onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="หมายเหตุ..."
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-navy">รวม ฿{cartTotal.toLocaleString()}</span>
                <button
                  onClick={submitOrder}
                  disabled={!orderName.trim() || cart.length === 0 || orderSaving}
                  className="bg-green-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm disabled:opacity-40">
                  {orderSaving ? "กำลังบันทึก..." : "✅ ส่งออเดอร์"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
