"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { MenuItemType, CartSelectedAddon, CartSelectedOption } from "@/types";

type CartEntry = {
  cartKey: string;
  menuItemId: number;
  nameTh: string;
  unitPriceTHB: number;
  qty: number;
  selectedSize: string | null;
  selectedAddons: CartSelectedAddon[];
  selectedOptions: CartSelectedOption[];
};

const CAT_LABELS: Record<string, string> = {
  milktea: "🧋 Milk & Tea", coffee: "☕ Coffee", soda: "🥤 Soda",
  drink: "🧊 เครื่องดื่ม", food: "🍜 อาหาร", snack: "🍿 ของทานเล่น", dessert: "🍮 ของหวาน",
};

// ---- Item detail picker (size / addons / options) ----
function ItemDetail({ item, onClose, onAdd }: {
  item: MenuItemType;
  onClose: () => void;
  onAdd: (name: string, price: number, size: string | null, addons: CartSelectedAddon[], options: CartSelectedOption[]) => void;
}) {
  const hasSizes = item.priceS != null || item.priceXL != null;
  const [size, setSize] = useState<"S" | "XL">("S");
  const [addons, setAddons] = useState<CartSelectedAddon[]>([]);
  const [options, setOptions] = useState<CartSelectedOption[]>(() => {
    const defs: CartSelectedOption[] = [];
    for (const og of item.optionGroups) {
      const def = og.choices.find((c) => c.isDefault && c.isActive);
      if (def) defs.push({ groupId: og.id, groupName: og.nameTh, choiceId: def.id, choiceName: def.nameTh, priceTHB: def.priceTHB });
    }
    return defs;
  });

  let basePrice = item.priceTHB;
  if (hasSizes && size === "S" && item.priceS != null) basePrice = item.priceS;
  if (hasSizes && size === "XL" && item.priceXL != null) basePrice = item.priceXL;
  const total = basePrice + addons.reduce((s, a) => s + a.priceTHB, 0) + options.reduce((s, o) => s + o.priceTHB, 0);

  function add() {
    const sizeLabel = hasSizes ? ` (${size})` : "";
    const extras = [...addons.map((a) => a.nameTh), ...options.map((o) => o.choiceName)].filter(Boolean).join(", ");
    const fullName = `${item.nameTh}${sizeLabel}${extras ? ` + ${extras}` : ""}`;
    onAdd(fullName, total, hasSizes ? size : null, addons, options);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-sand shrink-0">
          <h3 className="font-bold text-navy">{item.nameTh}</h3>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {hasSizes && (
            <div>
              <p className="text-sm font-semibold text-navy mb-2">เลือกขนาด</p>
              <div className="flex gap-3">
                {item.priceS != null && <button type="button" onClick={() => setSize("S")} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm ${size === "S" ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"}`}>S — ฿{item.priceS}</button>}
                {item.priceXL != null && <button type="button" onClick={() => setSize("XL")} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm ${size === "XL" ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"}`}>XL — ฿{item.priceXL}</button>}
              </div>
            </div>
          )}
          {item.addonGroups.map((group) => (
            <div key={group.id}>
              <p className="text-sm font-semibold text-navy mb-2">{group.nameTh}</p>
              <div className="space-y-2">
                {group.items.filter((gi) => gi.isActive).map((ai) => {
                  const sel = addons.some((a) => a.id === ai.id);
                  return (
                    <button key={ai.id} type="button"
                      onClick={() => setAddons((prev) => sel ? prev.filter((a) => a.id !== ai.id) : [...prev, { id: ai.id, groupId: group.id, nameTh: ai.nameTh, priceTHB: ai.priceTHB }])}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 ${sel ? "border-orange bg-orange/10" : "border-sand"}`}>
                      <span className={`text-sm font-medium flex items-center gap-1.5 ${sel ? "text-orange" : "text-navy"}`}>{sel && <span>✓</span>}{ai.nameTh}</span>
                      <span className="text-sm text-gray-500">+฿{ai.priceTHB}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {item.optionGroups.map((group) => {
            const sel = options.find((o) => o.groupId === group.id);
            return (
              <div key={group.id}>
                <p className="text-sm font-semibold text-navy mb-2 flex items-center gap-2">
                  {group.nameTh}{group.isRequired && <span className="text-xs text-orange font-normal">*บังคับ</span>}
                </p>
                <div className="space-y-2">
                  {!group.isRequired && (
                    <button type="button" onClick={() => setOptions((prev) => prev.filter((o) => o.groupId !== group.id))}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 ${!sel ? "border-orange bg-orange/10" : "border-sand"}`}>
                      <span className={`text-sm font-medium ${!sel ? "text-orange" : "text-navy"}`}>{!sel && "✓ "}ไม่ระบุ</span>
                      <span className="text-sm text-gray-400">ฟรี</span>
                    </button>
                  )}
                  {group.choices.filter((c) => c.isActive).map((choice) => {
                    const isSel = sel?.choiceId === choice.id;
                    return (
                      <button key={choice.id} type="button"
                        onClick={() => setOptions((prev) => [...prev.filter((o) => o.groupId !== group.id), { groupId: group.id, groupName: group.nameTh, choiceId: choice.id, choiceName: choice.nameTh, priceTHB: choice.priceTHB }])}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 ${isSel ? "border-orange bg-orange/10" : "border-sand"}`}>
                        <span className={`text-sm font-medium ${isSel ? "text-orange" : "text-navy"}`}>{isSel && "✓ "}{choice.nameTh}</span>
                        <span className="text-sm text-gray-500">{choice.priceTHB > 0 ? `+฿${choice.priceTHB}` : "ฟรี"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-sand p-4 shrink-0">
          <button type="button" onClick={add} className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm">
            เพิ่มลงออเดอร์ · ฿{total}
          </button>
        </div>
      </div>
    </div>
  );
}

type MemberInfo = { id: number; firstName: string; username: string; memberCode: string; dicePoints: number };

export default function CashierOrderButton({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [orderName, setOrderName] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailItem, setDetailItem] = useState<MenuItemType | null>(null);

  // Member code for dice points
  const [memberCode, setMemberCode] = useState("");
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
  const [memberError, setMemberError] = useState("");
  const [memberLoading, setMemberLoading] = useState(false);
  const memberTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMenu = useCallback(async () => {
    const res = await fetch("/api/menu").then((r) => r.json()).catch(() => []);
    const items = Array.isArray(res) ? (res as MenuItemType[]) : [];
    setMenuItems(items.filter((m) => m.isAvailable && m.category !== "gametime"));
  }, []);

  function openModal() { setOpen(true); loadMenu(); }
  function closeModal() {
    setOpen(false); setCart([]); setOrderName(""); setOrderNote(""); setSearch("");
    setMemberCode(""); setMemberInfo(null); setMemberError("");
  }

  function onMemberCodeChange(code: string) {
    setMemberCode(code);
    setMemberError("");
    if (!code.trim()) { setMemberInfo(null); return; }
    if (memberTimerRef.current) clearTimeout(memberTimerRef.current);
    memberTimerRef.current = setTimeout(async () => {
      setMemberLoading(true);
      const res = await fetch(`/api/pos/member?code=${encodeURIComponent(code.trim().toUpperCase())}`);
      setMemberLoading(false);
      if (res.ok) {
        const m: MemberInfo = await res.json();
        setMemberInfo(m);
        if (!orderName.trim()) setOrderName(m.firstName);
      } else {
        setMemberInfo(null);
        setMemberError("ไม่พบสมาชิก");
      }
    }, 500);
  }

  function pickItem(item: MenuItemType) {
    const needsDetail = item.priceS != null || item.priceXL != null || item.addonGroups.length > 0 || item.optionGroups.length > 0;
    if (needsDetail) { setDetailItem(item); return; }
    addToCart(item, item.nameTh, item.priceTHB, null, [], []);
  }

  function addToCart(item: MenuItemType, name: string, price: number, size: string | null, addons: CartSelectedAddon[], options: CartSelectedOption[]) {
    const cartKey = `${item.id}-${size ?? ""}-${addons.map((a) => a.id).join(",")}-${options.map((o) => o.choiceId).join(",")}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.cartKey === cartKey);
      if (existing) return prev.map((c) => c.cartKey === cartKey ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { cartKey, menuItemId: item.id, nameTh: name, unitPriceTHB: price, qty: 1, selectedSize: size, selectedAddons: addons, selectedOptions: options }];
    });
    setDetailItem(null);
  }

  function changeQty(cartKey: string, delta: number) {
    setCart((prev) => prev.map((c) => c.cartKey === cartKey ? { ...c, qty: c.qty + delta } : c).filter((c) => c.qty > 0));
  }

  const total = cart.reduce((s, c) => s + c.unitPriceTHB * c.qty, 0);

  async function submit() {
    if (!orderName.trim() || cart.length === 0) return;
    setSaving(true);
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderName: orderName.trim(),
        note: orderNote.trim() || undefined,
        source: "cashier",
        userId: memberInfo?.id ?? null,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          quantity: c.qty,
          selectedSize: c.selectedSize,
          selectedAddons: c.selectedAddons,
          selectedOptions: c.selectedOptions,
        })),
      }),
    });
    setSaving(false);
    closeModal();
    onCreated?.();
  }

  const filtered = menuItems.filter((m) => !search || m.nameTh.includes(search) || m.nameEn.toLowerCase().includes(search.toLowerCase()));
  const categories = [...new Set(filtered.map((m) => m.category))];

  return (
    <>
      <button onClick={openModal} className="bg-orange hover:bg-orange/90 text-white font-bold px-5 py-2.5 rounded-2xl text-sm shadow-lg transition-colors">
        🛒 สั่งอาหาร (เคาน์เตอร์)
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sand shrink-0">
              <h3 className="font-bold text-navy text-lg">🛒 สั่งอาหาร (เคาน์เตอร์)</h3>
              <button onClick={closeModal} className="text-gray-400 text-2xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-navy block mb-1">ชื่อลูกค้า *</label>
                <input value={orderName} onChange={(e) => setOrderName(e.target.value)}
                  placeholder="เช่น คุณสมชาย หรือ โต๊ะ 3"
                  className="w-full border-2 border-sand rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange" />
              </div>

              <div>
                <label className="text-xs font-semibold text-navy block mb-1">รหัสสมาชิก <span className="text-gray-400 font-normal">(ไม่บังคับ — เพื่อสะสมแต้ม)</span></label>
                <input
                  value={memberCode}
                  onChange={(e) => onMemberCodeChange(e.target.value.toUpperCase())}
                  placeholder="DS-XXXX"
                  className="w-full border-2 border-sand rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange uppercase"
                />
                {memberLoading && <p className="text-xs text-gray-400 mt-1">กำลังค้นหา...</p>}
                {memberInfo && (
                  <div className="mt-1.5 flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <div>
                      <p className="text-xs text-green-700 font-semibold">✅ {memberInfo.firstName} (@{memberInfo.username})</p>
                      <p className="text-[11px] text-gray-400">{memberInfo.memberCode} · 🎲 {memberInfo.dicePoints} แต้ม</p>
                    </div>
                    <button onClick={() => { setMemberInfo(null); setMemberCode(""); }} className="text-gray-300 hover:text-red-400 text-lg ml-2">×</button>
                  </div>
                )}
                {memberError && <p className="text-xs text-red-500 mt-1">{memberError}</p>}
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 ค้นหารายการ..."
                className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />

              {categories.map((cat) => (
                <div key={cat}>
                  <p className="text-xs font-bold text-gray-400 mb-2">{CAT_LABELS[cat] ?? cat}</p>
                  <div className="space-y-1">
                    {filtered.filter((m) => m.category === cat).map((item) => {
                      const hasSizes = item.priceS != null || item.priceXL != null;
                      const hasOpts = item.addonGroups.length > 0 || item.optionGroups.length > 0;
                      return (
                        <button key={item.id} onClick={() => pickItem(item)}
                          className="w-full flex items-center justify-between gap-2 py-2 px-2 rounded-lg hover:bg-sand/40 text-left">
                          <span className="text-sm text-navy flex-1">{item.nameTh}{(hasSizes || hasOpts) && <span className="text-[10px] text-gray-400 ml-1">· ตัวเลือก</span>}</span>
                          <span className="text-xs bg-orange/10 text-orange border border-orange/30 px-3 py-1 rounded-lg font-semibold shrink-0">
                            {hasSizes ? `฿${item.priceS ?? item.priceTHB}+` : `฿${item.priceTHB}`} +
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-sand p-4 space-y-3 shrink-0 bg-white">
              {cart.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {cart.map((c) => (
                    <div key={c.cartKey} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 text-navy truncate">{c.nameTh}</span>
                      <span className="text-gray-400 shrink-0">฿{c.unitPriceTHB}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => changeQty(c.cartKey, -1)} className="w-6 h-6 rounded-full bg-sand text-navy font-bold flex items-center justify-center">−</button>
                        <span className="w-5 text-center font-bold text-navy">{c.qty}</span>
                        <button onClick={() => changeQty(c.cartKey, 1)} className="w-6 h-6 rounded-full bg-orange text-white font-bold flex items-center justify-center">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <input value={orderNote} onChange={(e) => setOrderNote(e.target.value)}
                placeholder="📝 หมายเหตุ..."
                className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
              <div className="flex items-center justify-between">
                <span className="font-bold text-navy">รวม ฿{total.toLocaleString()}</span>
                <button onClick={submit} disabled={!orderName.trim() || cart.length === 0 || saving}
                  className="bg-green-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm disabled:opacity-40">
                  {saving ? "กำลังบันทึก..." : "✅ ส่งออเดอร์"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailItem && (
        <ItemDetail item={detailItem} onClose={() => setDetailItem(null)}
          onAdd={(name, price, size, addons, options) => addToCart(detailItem, name, price, size, addons, options)} />
      )}
    </>
  );
}
