"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { MenuItemType, CartSelectedAddon, CartSelectedOption } from "@/types";

type MemberRef = { id: number; username: string; memberCode: string; firstName: string };
type PlayerSession = {
  id: number; nickname: string; packageType: string; packagePrice: number;
  timeRemaining: number; status: string; updatedAt: string;
  userId: number | null; user: MemberRef | null;
};
type PendingCash = { orderId: number; totalTHB: number; paymentId: number | null; staffNote: string | null };
type Bill = {
  id: number; name: string; color: string; tableId: number; startsAt: string; prepRemaining: number;
  table: { number: number }; sessions: PlayerSession[];
  pendingCash: PendingCash[];
};

const BILL_COLORS: Record<string, { gradient: string; accent: string }> = {
  indigo:  { gradient: "from-navy to-indigo-900",     accent: "bg-indigo-500" },
  emerald: { gradient: "from-emerald-800 to-emerald-950", accent: "bg-emerald-500" },
  rose:    { gradient: "from-rose-800 to-rose-950",    accent: "bg-rose-500" },
  amber:   { gradient: "from-amber-700 to-amber-900",  accent: "bg-amber-500" },
  violet:  { gradient: "from-violet-800 to-violet-950", accent: "bg-violet-500" },
  teal:    { gradient: "from-teal-700 to-teal-900",    accent: "bg-teal-500" },
  sky:     { gradient: "from-sky-700 to-sky-900",      accent: "bg-sky-500" },
  pink:    { gradient: "from-pink-700 to-pink-900",    accent: "bg-pink-500" },
};
type TableRef = { id: number; number: number };
type DrinkItem = MenuItemType;
type ExtraItem = {
  menuItemId: number; nameTh: string; priceTHB: number; qty: number;
  selectedSize: string | null; selectedAddons: CartSelectedAddon[]; selectedOptions: CartSelectedOption[];
  assignedPlayerIdx: number | null;
};

function getBangkokHHMM(): string {
  const now = new Date();
  const bkk = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60_000);
  return `${String(bkk.getHours()).padStart(2, "0")}:${String(bkk.getMinutes()).padStart(2, "0")}`;
}

function isWithinSellHours(start: string | null | undefined, end: string | null | undefined): boolean {
  if (!start || !end) return true;
  const now = getBangkokHHMM();
  return now >= start && now <= end;
}

const PACKAGES: Record<string, { label: string; price: number; timeSeconds: number; desc: string }> = {
  A: { label: "Package A", price: 0, timeSeconds: 3600, desc: "สั่งเครื่องดื่ม — เล่นฟรี 1 ชม." },
  B: { label: "Package B", price: 49, timeSeconds: 7200, desc: "49฿ — เล่น 2 ชม." },
  C: { label: "Package C", price: 120, timeSeconds: 86400, desc: "120฿ — เหมาวัน + ฟรีเครื่องดื่ม" },
  D: { label: "Package D", price: 80, timeSeconds: 86400, desc: "80฿ — อัพเกรดเป็นเหมาวัน" },
};
const DRINK_CATS = ["coffee", "milktea", "soda"];
const PKG_KEYS = ["A", "B", "C"] as const;
type PkgKey = (typeof PKG_KEYS)[number] | "D";

// ---- Timer Hooks ----
function useCountdown(initial: number) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => setSecs(initial), [initial]);
  useEffect(() => {
    const t = setInterval(() => setSecs((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return secs;
}

function fmt(secs: number) {
  if (secs >= 86400) return "∞";
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timerColor(secs: number) {
  if (secs >= 86400) return { bar: "bg-purple-400", text: "text-purple-300", label: "∞" };
  if (secs > 600) return { bar: "bg-green-400", text: "text-green-400", label: "ปกติ" };
  if (secs > 0) return { bar: "bg-yellow-400", text: "text-yellow-400", label: "ใกล้หมด" };
  return { bar: "bg-red-500", text: "text-red-400", label: "หมดเวลา!" };
}

// ---- Session Card ----
function SessionCard({ session, bill, prepRemaining, onCheckout, onExtend, onEdit }: {
  session: PlayerSession; bill: Bill; prepRemaining: number;
  onCheckout: (id: number) => void; onExtend: (session: PlayerSession, bill: Bill) => void;
  onEdit: (session: PlayerSession) => void;
}) {
  const prep = useCountdown(prepRemaining);
  const remaining = useCountdown(session.timeRemaining);
  const inPrep = prep > 0;
  const color = timerColor(remaining);
  const isAllDay = session.packageType === "C";
  const maxTime = PACKAGES[session.packageType]?.timeSeconds ?? 3600;
  const pct = remaining >= 86400 ? 100 : Math.min(100, (remaining / maxTime) * 100);

  return (
    <div className="bg-navy/80 rounded-2xl p-4 space-y-3 border border-white/10">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-base">{session.nickname}</p>
          <p className="text-white/50 text-xs">{PACKAGES[session.packageType]?.desc}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => onEdit(session)}
            className="text-white/40 hover:text-white/80 text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">
            ✏️
          </button>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${inPrep ? "text-sky-300" : isAllDay ? "text-purple-300" : color.text} border border-current`}>
            {inPrep ? "เตรียมตัว" : isAllDay ? "เหมาวัน" : color.label}
          </span>
        </div>
      </div>
      {session.user && (
        <div className="bg-green-500/15 border border-green-400/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <span className="text-sm">🎯</span>
          <span className="text-green-300 text-xs font-semibold">เก็บแต้มให้ {session.user.firstName} (@{session.user.username})</span>
        </div>
      )}
      {inPrep ? (
        <div>
          <div className="text-2xl font-mono font-bold text-sky-300">เริ่มใน {fmt(prep)}</div>
          <p className="text-white/40 text-xs mt-1">เวลาเล่น {isAllDay ? "ไม่จำกัด" : fmt(session.timeRemaining)} (ยังไม่เริ่มนับ)</p>
        </div>
      ) : isAllDay ? (
        <div className="text-2xl font-mono font-bold text-purple-300">∞ ไม่จำกัดเวลา</div>
      ) : (
        <div>
          <div className={`text-2xl font-mono font-bold ${color.text}`}>{fmt(remaining)}</div>
          <div className="mt-1.5 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${color.bar}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        {!isAllDay && (
          <button
            onClick={() => onExtend(session, bill)}
            className="flex-1 text-xs bg-white/10 hover:bg-white/20 text-white font-semibold py-2 rounded-xl transition-colors"
          >
            ⏱️ ต่อเวลา
          </button>
        )}
        <button onClick={() => onCheckout(session.id)}
          className="flex-1 text-xs bg-orange hover:bg-orange/80 text-white font-bold py-2 rounded-xl transition-colors">ปิด</button>
      </div>
    </div>
  );
}

// ---- Package picker ----
function PackagePicker({ value, onChange, drinkName, drinkPrice, onOpenDrinkPicker, qty, onQtyChange, blockedPkgs = new Set() }: {
  value: PkgKey; onChange: (k: PkgKey) => void;
  drinkName: string; drinkPrice: number; onOpenDrinkPicker: () => void;
  qty: number; onQtyChange: (q: number) => void;
  blockedPkgs?: Set<PkgKey>;
}) {
  const totalPrice = value === "B" ? PACKAGES.B.price * qty : PACKAGES[value].price + (value === "A" ? drinkPrice : 0);
  const totalHours = value === "B" ? 2 * qty : value === "A" ? 1 : "∞";
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {PKG_KEYS.map((k) => {
          const blocked = blockedPkgs.has(k);
          return (
            <button key={k} type="button" onClick={() => !blocked && onChange(k)} disabled={blocked}
              className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold border-2 transition-all ${
                blocked ? "border-sand bg-gray-50 text-gray-300 cursor-not-allowed opacity-50" :
                value === k ? "border-orange bg-orange/10 text-navy" : "border-sand text-gray-400 hover:border-orange/40"}`}
              title={blocked ? "ไม่รับออเดอร์ตอนนี้" : PACKAGES[k].desc}>
              {k}<span className="block text-[10px] font-normal">{blocked ? "ปิด" : PACKAGES[k].price === 0 ? "ฟรี" : `฿${PACKAGES[k].price}`}</span>
            </button>
          );
        })}
      </div>
      {(value === "A" || value === "C") && (
        <button type="button" onClick={onOpenDrinkPicker}
          className={`w-full text-left text-xs border-2 rounded-lg px-3 py-2 transition-all ${drinkName ? "border-orange bg-orange/5 text-navy" : "border-sand text-gray-400 hover:border-orange/40"}`}>
          {drinkName ? (
            <span className="flex items-center justify-between">
              <span>🥤 {drinkName}</span>
              <span className="text-orange font-semibold">{value === "A" ? `฿${drinkPrice}` : "รวมแล้ว"} · เปลี่ยน</span>
            </span>
          ) : "🥤 เลือกเครื่องดื่ม →"}
        </button>
      )}
      {value === "A" && drinkName && <p className="text-[10px] text-orange font-semibold pl-1">1ชม. ฟรี + เครื่องดื่ม ฿{drinkPrice}</p>}
      {value === "B" && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onQtyChange(Math.max(1, qty - 1))} className="w-6 h-6 rounded-full bg-sand hover:bg-orange/20 text-navy font-bold text-sm flex items-center justify-center">−</button>
          <span className="text-xs font-bold text-navy w-4 text-center">{qty}</span>
          <button type="button" onClick={() => onQtyChange(qty + 1)} className="w-6 h-6 rounded-full bg-sand hover:bg-orange/20 text-navy font-bold text-sm flex items-center justify-center">+</button>
          <span className="text-[10px] text-gray-400">{totalHours}ชม. · ฿{totalPrice}</span>
        </div>
      )}
    </div>
  );
}

type PlayerDraft = { nameOrCode: string; pkg: PkgKey; drinkName: string; drinkPrice: number; drinkMenuItemId: number | null; qty: number };
const BLANK_DRAFT: PlayerDraft = { nameOrCode: "", pkg: "A", drinkName: "", drinkPrice: 0, drinkMenuItemId: null, qty: 1 };

// ---- Item Detail Picker (shared for drink + extra items) ----
function ItemDetailPicker({ item, onClose, onConfirm, confirmLabel }: {
  item: DrinkItem; onClose: () => void;
  onConfirm: (name: string, price: number, menuItemId: number, size: string | null, addons: CartSelectedAddon[], options: CartSelectedOption[]) => void;
  confirmLabel: string;
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

  function confirm() {
    const sizeLabel = hasSizes ? ` (${size})` : "";
    const extras = [...addons.map((a) => a.nameTh), ...options.map((o) => o.choiceName)].filter(Boolean).join(", ");
    const fullName = `${item.nameTh}${sizeLabel}${extras ? ` + ${extras}` : ""}`;
    onConfirm(fullName, total, item.id, hasSizes ? size : null, addons, options);
  }

  return (
    <Modal onClose={onClose} title={item.nameTh}>
      <p className="text-xs text-gray-400 -mt-2 mb-3">{item.nameEn}</p>
      {hasSizes && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-navy mb-2">เลือกขนาด</p>
          <div className="flex gap-3">
            {item.priceS != null && <button type="button" onClick={() => setSize("S")} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${size === "S" ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"}`}>S — ฿{item.priceS}</button>}
            {item.priceXL != null && <button type="button" onClick={() => setSize("XL")} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${size === "XL" ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"}`}>XL — ฿{item.priceXL}</button>}
          </div>
        </div>
      )}
      {item.addonGroups.map((group) => (
        <div key={group.id} className="mb-4">
          <p className="text-sm font-semibold text-navy mb-2">{group.nameTh}</p>
          <div className="space-y-2">
            {group.items.filter((gi) => gi.isActive).map((ai) => {
              const sel = addons.some((a) => a.id === ai.id);
              return (
                <button key={ai.id} type="button"
                  onClick={() => setAddons((prev) => sel ? prev.filter((a) => a.id !== ai.id) : [...prev, { id: ai.id, groupId: group.id, nameTh: ai.nameTh, priceTHB: ai.priceTHB }])}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${sel ? "border-orange bg-orange/10" : "border-sand"}`}>
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
          <div key={group.id} className="mb-4">
            <p className="text-sm font-semibold text-navy mb-2 flex items-center gap-2">
              {group.nameTh}{group.isRequired && <span className="text-xs text-orange font-normal">*บังคับ</span>}
            </p>
            <div className="space-y-2">
              {!group.isRequired && (
                <button type="button" onClick={() => setOptions((prev) => prev.filter((o) => o.groupId !== group.id))}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${!sel ? "border-orange bg-orange/10" : "border-sand"}`}>
                  <span className={`text-sm font-medium ${!sel ? "text-orange" : "text-navy"}`}>{!sel && "✓ "}ไม่ระบุ</span>
                  <span className="text-sm text-gray-400">ฟรี</span>
                </button>
              )}
              {group.choices.filter((c) => c.isActive).map((choice) => {
                const isSel = sel?.choiceId === choice.id;
                return (
                  <button key={choice.id} type="button"
                    onClick={() => setOptions((prev) => [...prev.filter((o) => o.groupId !== group.id), { groupId: group.id, groupName: group.nameTh, choiceId: choice.id, choiceName: choice.nameTh, priceTHB: choice.priceTHB }])}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${isSel ? "border-orange bg-orange/10" : "border-sand"}`}>
                    <span className={`text-sm font-medium ${isSel ? "text-orange" : "text-navy"}`}>{isSel && "✓ "}{choice.nameTh}</span>
                    <span className="text-sm text-gray-500">{choice.priceTHB > 0 ? `+฿${choice.priceTHB}` : "ฟรี"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-3 border-t border-sand mb-3">
        <span className="text-sm text-gray-500">รวม</span>
        <span className="font-bold text-orange text-lg">฿{total}</span>
      </div>
      <button type="button" onClick={confirm} className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm">{confirmLabel}</button>
    </Modal>
  );
}

// ---- Extra Items List ----
function ExtraItemsList({ items, onChange, players }: {
  items: ExtraItem[];
  onChange: (items: ExtraItem[]) => void;
  players: { nameOrCode: string; pkg: string }[];
}) {
  if (items.length === 0) return null;
  const playerLabels = players.map((p, i) => p.nameOrCode.trim() || `P${i + 1}`);
  return (
    <div className="space-y-2 mt-2">
      {items.map((item, i) => (
        <div key={i} className="bg-orange/5 border border-orange/20 rounded-xl px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-navy truncate">{item.nameTh}</p>
              <p className="text-[10px] text-gray-400">฿{item.priceTHB} × {item.qty} = ฿{item.priceTHB * item.qty}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => onChange(items.map((x, j) => j === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}
                className="w-6 h-6 rounded-full bg-sand text-navy font-bold text-sm flex items-center justify-center">−</button>
              <span className="text-xs font-bold text-navy w-4 text-center">{item.qty}</span>
              <button type="button" onClick={() => onChange(items.map((x, j) => j === i ? { ...x, qty: x.qty + 1 } : x))}
                className="w-6 h-6 rounded-full bg-sand text-navy font-bold text-sm flex items-center justify-center">+</button>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="w-6 h-6 rounded-full bg-red-100 text-red-500 font-bold text-sm flex items-center justify-center ml-1">×</button>
            </div>
          </div>
          {players.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-gray-400 shrink-0">🎲 แต้มให้:</span>
              <button type="button"
                onClick={() => onChange(items.map((x, j) => j === i ? { ...x, assignedPlayerIdx: null } : x))}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${item.assignedPlayerIdx === null ? "bg-gray-200 border-gray-400 text-gray-700 font-bold" : "border-gray-200 text-gray-400 hover:border-gray-400"}`}>
                ไม่มี
              </button>
              {playerLabels.map((label, pi) => (
                <button key={pi} type="button"
                  onClick={() => onChange(items.map((x, j) => j === i ? { ...x, assignedPlayerIdx: pi } : x))}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${item.assignedPlayerIdx === pi ? "bg-orange border-orange text-white font-bold" : "border-orange/30 text-orange hover:border-orange"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Main Page ----
export default function AdminTimePage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [tables, setTables] = useState<TableRef[]>([]);
  const [drinks, setDrinks] = useState<DrinkItem[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<DrinkItem[]>([]);
  const [gametimeItems, setGametimeItems] = useState<DrinkItem[]>([]);
  const [allGametimeItems, setAllGametimeItems] = useState<DrinkItem[]>([]);
  const [loading, setLoading] = useState(true);

  // new-bill flow: step 0=dashboard, 1=bill, 2=players, 3=method, 4=QR+slip
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [billName, setBillName] = useState("");
  const [billTableId, setBillTableId] = useState<number | null>(null);
  const [draftBillId, setDraftBillId] = useState<number | null>(null);
  const [players, setPlayers] = useState<PlayerDraft[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  const [playerTotal, setPlayerTotal] = useState(0);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderQr, setOrderQr] = useState<{ qrDataUrl: string | null; accountName: string; bankName: string } | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [slipUploading, setSlipUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const slipInputRef = useRef<HTMLInputElement>(null);

  // addToBill flow
  const [addToBill, setAddToBill] = useState<Bill | null>(null);
  const [addPlayers, setAddPlayers] = useState<PlayerDraft[]>([{ ...BLANK_DRAFT }]);
  const [addExtraItems, setAddExtraItems] = useState<ExtraItem[]>([]);
  const [addBillStep, setAddBillStep] = useState<0 | 1 | 2>(0);
  const [addBillOrderId, setAddBillOrderId] = useState<number | null>(null);
  const [addBillQr, setAddBillQr] = useState<{ qrDataUrl: string | null; accountName: string; bankName: string } | null>(null);
  const [addBillPlayerTotal, setAddBillPlayerTotal] = useState(0);
  const [addBillSlipFile, setAddBillSlipFile] = useState<File | null>(null);
  const [addBillSlipPreview, setAddBillSlipPreview] = useState<string | null>(null);
  const [addBillSlipUploading, setAddBillSlipUploading] = useState(false);
  const addBillSlipInputRef = useRef<HTMLInputElement>(null);

  // changeTable flow
  const [changeTableBill, setChangeTableBill] = useState<Bill | null>(null);

  // renameBill / changeColor flow
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [editBillName, setEditBillName] = useState("");
  const [editBillColor, setEditBillColor] = useState("indigo");

  // session IDs from player creation (for dice points attribution)
  const [playerSessionIds, setPlayerSessionIds] = useState<number[]>([]);
  const [addBillPlayerSessionIds, setAddBillPlayerSessionIds] = useState<number[]>([]);

  // extend time flow
  const [extendSession, setExtendSession] = useState<PlayerSession | null>(null);
  const [extendBill, setExtendBill] = useState<Bill | null>(null);
  const [extendPkg, setExtendPkg] = useState<PkgKey>("B");
  const [extendQty, setExtendQty] = useState(1);
  const [extendStep, setExtendStep] = useState<0 | 1 | 2>(0); // 0=pkg+drink, 1=method, 2=QR+slip
  const [extendDrinkName, setExtendDrinkName] = useState("");
  const [extendDrinkPrice, setExtendDrinkPrice] = useState(0);
  const [extendDrinkMenuItemId, setExtendDrinkMenuItemId] = useState<number | null>(null);
  const [extendOrderId, setExtendOrderId] = useState<number | null>(null);
  const [extendQr, setExtendQr] = useState<{ qrDataUrl: string | null; accountName: string; bankName: string } | null>(null);
  const [extendSlipFile, setExtendSlipFile] = useState<File | null>(null);
  const [extendSlipPreview, setExtendSlipPreview] = useState<string | null>(null);
  const [extendSlipUploading, setExtendSlipUploading] = useState(false);
  const extendSlipRef = useRef<HTMLInputElement>(null);

  // edit session modal
  const [editingSession, setEditingSession] = useState<PlayerSession | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editMemberCode, setEditMemberCode] = useState("");
  const [editMemberInfo, setEditMemberInfo] = useState<MemberRef | null>(null);
  const [editMemberError, setEditMemberError] = useState("");
  const [editMemberLoading, setEditMemberLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  function openEditSession(session: PlayerSession) {
    setEditingSession(session);
    setEditNickname(session.nickname);
    setEditMemberCode(session.user?.memberCode ?? "");
    setEditMemberInfo(session.user ?? null);
    setEditMemberError("");
  }

  async function lookupEditMember(code: string) {
    setEditMemberCode(code);
    setEditMemberError("");
    if (!code.trim()) { setEditMemberInfo(null); return; }
    setEditMemberLoading(true);
    const res = await fetch(`/api/pos/member?code=${encodeURIComponent(code.trim().toUpperCase())}`);
    setEditMemberLoading(false);
    if (res.ok) { setEditMemberInfo(await res.json()); }
    else { setEditMemberInfo(null); setEditMemberError("ไม่พบสมาชิก"); }
  }

  async function saveEditSession() {
    if (!editingSession) return;
    setEditSaving(true);
    const body: Record<string, unknown> = {};
    if (editNickname.trim() && editNickname.trim() !== editingSession.nickname) body.nickname = editNickname.trim();
    if (editMemberInfo && editMemberInfo.id !== editingSession.userId) body.userId = editMemberInfo.id;
    if (!editMemberInfo && editMemberCode === "" && editingSession.userId) body.userId = null;
    if (Object.keys(body).length > 0) {
      await fetch(`/api/pos/sessions/${editingSession.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      load();
    }
    setEditSaving(false);
    setEditingSession(null);
  }

  // cash amount input modal
  const [cashInputOpen, setCashInputOpen] = useState(false);
  const [cashInputStr, setCashInputStr] = useState("");
  const [cashInputTotal, setCashInputTotal] = useState(0);
  const [cashInputAction, setCashInputAction] = useState<"new" | "addBill" | "extend">("new");

  function openCashInput(total: number, action: "new" | "addBill" | "extend") {
    setCashInputTotal(total);
    setCashInputStr("");
    setCashInputAction(action);
    setCashInputOpen(true);
  }

  async function confirmCashInput() {
    const received = parseInt(cashInputStr.replace(/,/g, ""), 10) || 0;
    if (received < cashInputTotal) { window.alert("ยอดเงินที่รับมาไม่เพียงพอ"); return; }
    setCashInputOpen(false);
    if (cashInputAction === "extend") await chooseExtendCash(received);
  }

  // item picker (drink or extra item) — list then detail
  type PickerCtx = { list: "players"; idx: number } | { list: "addPlayers"; idx: number } | { list: "extraItems" } | { list: "addExtraItems" } | { list: "extendDrink" };
  const [pickerCtx, setPickerCtx] = useState<PickerCtx | null>(null);
  const [pickerItem, setPickerItem] = useState<DrinkItem | null>(null);

  const load = useCallback(async () => {
    const [b, t, m] = await Promise.all([
      fetch("/api/pos/bills").then((r) => r.json()).catch(() => []),
      fetch("/api/tables").then((r) => r.json()).catch(() => []),
      fetch("/api/menu").then((r) => r.json()).catch(() => []),
    ]);
    setBills(Array.isArray(b) ? b : []);
    setTables(Array.isArray(t) ? t : []);
    const menu = Array.isArray(m) ? (m as DrinkItem[]) : [];
    setDrinks(menu.filter((item) => DRINK_CATS.includes(item.category) && isWithinSellHours(item.sellStartTime, item.sellEndTime)));
    setAllMenuItems(menu.filter((item) => item.category !== "gametime" && item.isAvailable && isWithinSellHours(item.sellStartTime, item.sellEndTime)));
    const allGt = menu.filter((item) => item.category === "gametime" && item.isAvailable);
    setAllGametimeItems(allGt);
    setGametimeItems(allGt.filter((item) => isWithinSellHours(item.sellStartTime, item.sellEndTime)));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // ---- Item picker ----
  function openPickerList(ctx: PickerCtx) { setPickerCtx(ctx); setPickerItem(null); }
  function closePickerAll() { setPickerCtx(null); setPickerItem(null); }

  function onItemDetailConfirm(name: string, price: number, menuItemId: number, size: string | null, addons: CartSelectedAddon[], options: CartSelectedOption[]) {
    if (!pickerCtx) return;
    if (pickerCtx.list === "players") {
      setPlayers((prev) => prev.map((x, idx) => idx === (pickerCtx as { list: "players"; idx: number }).idx
        ? { ...x, drinkName: name, drinkPrice: price, drinkMenuItemId: menuItemId } : x));
    } else if (pickerCtx.list === "addPlayers") {
      setAddPlayers((prev) => prev.map((x, idx) => idx === (pickerCtx as { list: "addPlayers"; idx: number }).idx
        ? { ...x, drinkName: name, drinkPrice: price, drinkMenuItemId: menuItemId } : x));
    } else if (pickerCtx.list === "extraItems") {
      setExtraItems((prev) => [...prev, { menuItemId, nameTh: name, priceTHB: price, qty: 1, selectedSize: size, selectedAddons: addons, selectedOptions: options, assignedPlayerIdx: null }]);
    } else if (pickerCtx.list === "extendDrink") {
      setExtendDrinkName(name);
      setExtendDrinkPrice(price);
      setExtendDrinkMenuItemId(menuItemId);
    } else {
      setAddExtraItems((prev) => [...prev, { menuItemId, nameTh: name, priceTHB: price, qty: 1, selectedSize: size, selectedAddons: addons, selectedOptions: options, assignedPlayerIdx: null }]);
    }
    closePickerAll();
  }

  // ---- Build order line items ----
  function buildLineItems(draftPlayers: PlayerDraft[], draftExtra: ExtraItem[]) {
    const items: { menuItemId: number; nameTh: string; unitPriceTHB: number; qty: number; selectedSize?: string; selectedAddons?: string; selectedOptions?: string }[] = [];
    for (const p of draftPlayers) {
      const gtItem = gametimeItems.find((g) => g.nameEn === `gametime-${p.pkg}`);
      if (gtItem) {
        const pkgQty = p.pkg === "B" ? p.qty : 1;
        const pkgPrice = PACKAGES[p.pkg]?.price ?? 0;
        items.push({ menuItemId: gtItem.id, nameTh: gtItem.nameTh, unitPriceTHB: pkgPrice, qty: pkgQty });
      }
      if (p.drinkMenuItemId && (p.pkg === "A" || p.pkg === "C")) {
        items.push({ menuItemId: p.drinkMenuItemId, nameTh: p.drinkName, unitPriceTHB: p.pkg === "A" ? p.drinkPrice : 0, qty: 1 });
      }
    }
    for (const e of draftExtra) {
      items.push({
        menuItemId: e.menuItemId, nameTh: e.nameTh, unitPriceTHB: e.priceTHB, qty: e.qty,
        ...(e.selectedSize ? { selectedSize: e.selectedSize } : {}),
        ...(e.selectedAddons.length ? { selectedAddons: JSON.stringify(e.selectedAddons) } : {}),
        ...(e.selectedOptions.length ? { selectedOptions: JSON.stringify(e.selectedOptions) } : {}),
      });
    }
    return items;
  }

  function buildExtendLineItems() {
    const items: { menuItemId: number; nameTh: string; unitPriceTHB: number; qty: number }[] = [];
    const gtItem = gametimeItems.find((g) => g.nameEn === `gametime-${extendPkg}`);
    if (gtItem) {
      const qty = extendPkg === "B" ? extendQty : 1;
      const price = PACKAGES[extendPkg]?.price ?? 0;
      items.push({ menuItemId: gtItem.id, nameTh: gtItem.nameTh, unitPriceTHB: price, qty });
    }
    if ((extendPkg === "A" || extendPkg === "D") && extendDrinkMenuItemId) {
      items.push({ menuItemId: extendDrinkMenuItemId, nameTh: extendDrinkName, unitPriceTHB: extendPkg === "A" ? extendDrinkPrice : 0, qty: 1 });
    }
    return items;
  }

  async function patchExtraSpend(items: ExtraItem[], sessionIds: number[]) {
    const spendByIdx: Record<number, number> = {};
    for (const item of items) {
      if (item.assignedPlayerIdx !== null) {
        spendByIdx[item.assignedPlayerIdx] = (spendByIdx[item.assignedPlayerIdx] ?? 0) + item.priceTHB * item.qty;
      }
    }
    await Promise.all(
      Object.entries(spendByIdx).map(([idx, spend]) => {
        const sid = sessionIds[Number(idx)];
        if (!sid || spend <= 0) return Promise.resolve();
        return fetch(`/api/pos/sessions/${sid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addExtraSpend: spend }),
        });
      })
    );
  }

  async function createOrder(method: "CASH" | "PROMPTPAY" | "UNSET", billId: number, grandTotal: number, draftPlayers: PlayerDraft[], draftExtra: ExtraItem[], opts?: { receivedAmount?: number; includePendingPlayers?: boolean }) {
    const items = buildLineItems(draftPlayers, draftExtra);
    const pendingPlayers = opts?.includePendingPlayers
      ? draftPlayers.map((p) => ({ nameOrCode: p.nameOrCode, packageType: p.pkg, drinkName: p.drinkName, drinkPrice: p.drinkPrice, qty: p.qty }))
      : undefined;
    const pendingExtras = opts?.includePendingPlayers
      ? draftExtra.map((e) => ({ menuItemId: e.menuItemId, qty: e.qty, unitPriceTHB: e.priceTHB, assignedPlayerIdx: e.assignedPlayerIdx }))
      : undefined;
    const res = await fetch(`/api/pos/bills/${billId}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod: method, items, totalTHB: grandTotal, pendingPlayers, pendingExtras }),
    });
    if (!res.ok) { window.alert("สร้างออเดอร์ไม่สำเร็จ"); return null; }
    return await res.json() as { orderId: number; totalTHB: number; qrDataUrl: string | null; accountName: string; bankName: string };
  }

  // ---- New bill flow ----
  function openBillFlow() {
    setBillName(""); setBillTableId(tables[0]?.id ?? null);
    setDraftBillId(null); setPlayers([{ ...BLANK_DRAFT }]); setExtraItems([]);
    setPlayerTotal(0); setOrderId(null); setOrderQr(null);
    setSlipFile(null); setSlipPreview(null); setStep(1);
  }

  async function confirmOpenBill() {
    if (!billName.trim() || !billTableId) return;
    setSaving(true);
    const res = await fetch("/api/pos/bills", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: billName.trim(), tableId: billTableId }),
    });
    setSaving(false);
    if (!res.ok) { window.alert("เปิดบิลไม่สำเร็จ"); return; }
    const bill = await res.json();
    setDraftBillId(bill.id);
    setPlayers([{ ...BLANK_DRAFT }]);
    setStep(2);
  }

  // Calculate player total client-side (mirrors server logic in /api/pos/bills/[id]/players)
  function calcPlayersTotal(draftPlayers: PlayerDraft[]): number {
    return draftPlayers.reduce((sum, p) => {
      const pkgPrice = (PACKAGES[p.pkg]?.price ?? 0) * (p.pkg === "B" ? p.qty : 1);
      const drinkCharge = p.pkg === "A" ? Math.max(0, p.drinkPrice) : 0;
      return sum + pkgPrice + drinkCharge;
    }, 0);
  }

  // Create player sessions on the server — called AFTER cashier confirms payment method
  async function createSessions(billId: number, draftPlayers: PlayerDraft[]): Promise<number[] | null> {
    const res = await fetch(`/api/pos/bills/${billId}/players`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: draftPlayers.map((p) => ({ nameOrCode: p.nameOrCode, packageType: p.pkg, drinkName: p.drinkName, drinkPrice: p.drinkPrice, qty: p.qty })) }),
    });
    if (!res.ok) { window.alert("บันทึกผู้เล่นไม่สำเร็จ"); return null; }
    const data = await res.json();
    return (data.sessions ?? []).map((s: { id: number }) => s.id);
  }

  // ยืนยันผู้เล่น → ไปหน้าชำระเงินก่อน ยังไม่สร้าง sessions
  function confirmPlayers() {
    if (!draftBillId) return;
    const needsDrink = players.find((p) => (p.pkg === "A" || p.pkg === "C") && !p.drinkName);
    if (needsDrink) { window.alert("กรุณาเลือกเครื่องดื่มให้ครบทุกคน (แพ็กเกจ A และ C ต้องเลือกเครื่องดื่ม)"); return; }
    setStep(3);
  }

  function grandTotal() {
    return calcPlayersTotal(players) + extraItems.reduce((s, e) => s + e.priceTHB * e.qty, 0);
  }

  async function chooseCash() {
    if (!draftBillId) return;
    setSaving(true);
    // Sessions created AFTER cashier confirms — send player data with order
    await createOrder("CASH", draftBillId, grandTotal(), players, extraItems, { includePendingPlayers: true });
    setSaving(false);
    closeFlow();
  }

  async function chooseDefer() {
    if (!draftBillId) return;
    setSaving(true);
    // Defer payment-method choice to the cashier dashboard
    await createOrder("UNSET", draftBillId, grandTotal(), players, extraItems, { includePendingPlayers: true });
    setSaving(false);
    closeFlow();
  }

  async function chooseQR() {
    if (!draftBillId) return;
    setSaving(true);
    const result = await createOrder("PROMPTPAY", draftBillId, grandTotal(), players, extraItems, { includePendingPlayers: true });
    setSaving(false);
    if (!result) return;
    setOrderId(result.orderId);
    setOrderQr({ qrDataUrl: result.qrDataUrl, accountName: result.accountName, bankName: result.bankName });
    setStep(4);
  }

  async function submitSlip() {
    if (!slipFile || !orderId) return;
    setSlipUploading(true);
    const fd = new FormData();
    fd.append("orderId", String(orderId));
    fd.append("slip", slipFile);
    await fetch("/api/payment/slip", { method: "POST", body: fd });
    setSlipUploading(false);
    closeFlow();
  }

  function closeFlow() {
    setStep(0); setExtraItems([]); setPlayerTotal(0);
    setOrderId(null); setOrderQr(null); setSlipFile(null); setSlipPreview(null);
    load();
  }

  // ---- Add to bill flow ----
  function openAddToBill(bill: Bill) {
    setAddToBill(bill); setAddPlayers([{ ...BLANK_DRAFT }]); setAddExtraItems([]);
    setAddBillStep(0); setAddBillOrderId(null); setAddBillQr(null);
    setAddBillPlayerTotal(0); setAddBillSlipFile(null); setAddBillSlipPreview(null);
  }

  // ยืนยันผู้เล่น (เพิ่มในบิล) → ไปหน้าชำระเงินก่อน ยังไม่สร้าง sessions
  function submitAddPlayers() {
    if (!addToBill) return;
    const needsDrink = addPlayers.find((p) => (p.pkg === "A" || p.pkg === "C") && !p.drinkName);
    if (needsDrink) { window.alert("กรุณาเลือกเครื่องดื่มให้ครบทุกคน (แพ็กเกจ A และ C ต้องเลือกเครื่องดื่ม)"); return; }
    setAddBillStep(1);
  }

  function addBillGrandTotal() {
    return calcPlayersTotal(addPlayers) + addExtraItems.reduce((s, e) => s + e.priceTHB * e.qty, 0);
  }

  async function chooseAddBillCash() {
    if (!addToBill) return;
    setSaving(true);
    // Sessions created AFTER cashier confirms — send player data with order
    await createOrder("CASH", addToBill.id, addBillGrandTotal(), addPlayers, addExtraItems, { includePendingPlayers: true });
    setSaving(false);
    closeAddBillFlow();
  }

  async function chooseAddBillDefer() {
    if (!addToBill) return;
    setSaving(true);
    await createOrder("UNSET", addToBill.id, addBillGrandTotal(), addPlayers, addExtraItems, { includePendingPlayers: true });
    setSaving(false);
    closeAddBillFlow();
  }

  async function chooseAddBillQR() {
    if (!addToBill) return;
    setSaving(true);
    const result = await createOrder("PROMPTPAY", addToBill.id, addBillGrandTotal(), addPlayers, addExtraItems, { includePendingPlayers: true });
    setSaving(false);
    if (!result) return;
    setAddBillOrderId(result.orderId);
    setAddBillQr({ qrDataUrl: result.qrDataUrl, accountName: result.accountName, bankName: result.bankName });
    setAddBillStep(2);
  }

  async function submitAddBillSlip() {
    if (!addBillSlipFile || !addBillOrderId) return;
    setAddBillSlipUploading(true);
    const fd = new FormData();
    fd.append("orderId", String(addBillOrderId));
    fd.append("slip", addBillSlipFile);
    await fetch("/api/payment/slip", { method: "POST", body: fd });
    setAddBillSlipUploading(false);
    closeAddBillFlow();
  }

  function closeAddBillFlow() {
    setAddToBill(null); setAddPlayers([{ ...BLANK_DRAFT }]); setAddExtraItems([]);
    setAddBillStep(0); setAddBillOrderId(null); setAddBillQr(null);
    setAddBillPlayerTotal(0); setAddBillSlipFile(null); setAddBillSlipPreview(null);
    load();
  }

  async function checkout(sessionId: number) {
    if (!confirm("ปิดผู้เล่นคนนี้?")) return;
    await fetch(`/api/pos/sessions/${sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PAID" }) });
    load();
  }

  async function addTime(sessionId: number, seconds: number) {
    await fetch(`/api/pos/sessions/${sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addSeconds: seconds }) });
    load();
  }

  async function closeBill(bill: Bill) {
    if (!confirm(`ปิดบิล "${bill.name}" ทั้งหมด?`)) return;
    await fetch(`/api/pos/bills/${bill.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CLOSED" }) });
    load();
  }

  async function submitChangeTable(tableId: number) {
    if (!changeTableBill) return;
    await fetch(`/api/pos/bills/${changeTableBill.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tableId }) });
    setChangeTableBill(null); load();
  }

  function openExtend(session: PlayerSession, bill: Bill) {
    setExtendSession(session); setExtendBill(bill);
    setExtendPkg("B"); setExtendQty(1); setExtendStep(0);
    setExtendDrinkName(""); setExtendDrinkPrice(0); setExtendDrinkMenuItemId(null);
    setExtendOrderId(null); setExtendQr(null);
    setExtendSlipFile(null); setExtendSlipPreview(null);
  }

  function extendTotal() {
    if (extendPkg === "A") return extendDrinkPrice;
    if (extendPkg === "B") return PACKAGES.B.price * extendQty;
    if (extendPkg === "D") return PACKAGES.D.price;
    return 0;
  }

  async function addExtendTime() {
    if (!extendSession) return;
    if (extendPkg === "D") {
      await fetch(`/api/pos/sessions/${extendSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upgradeToAllDay: true }),
      });
    } else {
      const addSecs = extendPkg === "B" ? PACKAGES.B.timeSeconds * extendQty : PACKAGES.A.timeSeconds;
      await fetch(`/api/pos/sessions/${extendSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addSeconds: addSecs }),
      });
    }
  }

  async function chooseExtendCash(received?: number) {
    if (!extendBill) return;
    setSaving(true);
    await fetch(`/api/pos/bills/${extendBill.id}/order`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod: "CASH", items: buildExtendLineItems(), totalTHB: extendTotal(), receivedAmount: received }),
    });
    await addExtendTime();
    setSaving(false);
    closeExtendFlow();
  }

  async function chooseExtendQR() {
    if (!extendBill) return;
    setSaving(true);
    const res = await fetch(`/api/pos/bills/${extendBill.id}/order`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod: "PROMPTPAY", items: buildExtendLineItems(), totalTHB: extendTotal() }),
    });
    setSaving(false);
    if (!res.ok) { window.alert("สร้างออเดอร์ไม่สำเร็จ"); return; }
    const data = await res.json();
    setExtendOrderId(data.orderId);
    setExtendQr({ qrDataUrl: data.qrDataUrl, accountName: data.accountName, bankName: data.bankName });
    setExtendStep(2);
  }

  async function submitExtendSlip() {
    if (!extendSlipFile || !extendOrderId) return;
    setExtendSlipUploading(true);
    const fd = new FormData();
    fd.append("orderId", String(extendOrderId));
    fd.append("slip", extendSlipFile);
    await fetch("/api/payment/slip", { method: "POST", body: fd });
    await addExtendTime();
    setExtendSlipUploading(false);
    closeExtendFlow();
  }

  function closeExtendFlow() {
    setExtendSession(null); setExtendBill(null); setExtendStep(0);
    load();
  }

  async function submitEditBill() {
    if (!editBill || !editBillName.trim()) return;
    await fetch(`/api/pos/bills/${editBill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editBillName.trim(), color: editBillColor }),
    });
    setEditBill(null); load();
  }

  // Packages whose gametime menu item exists but is currently outside sell hours
  const blockedPkgKeys = new Set(
    (["A", "B", "C", "D"] as PkgKey[]).filter((k) => {
      const exists = allGametimeItems.some((g) => g.nameEn === `gametime-${k}`);
      const available = gametimeItems.some((g) => g.nameEn === `gametime-${k}`);
      return exists && !available;
    })
  );

  // ---- Player row shared render ----
  function renderPlayerRow(p: PlayerDraft, i: number, isAdd: boolean) {
    const allPlayers = isAdd ? addPlayers : players;
    const canDelete = allPlayers.length > 1;
    const set = isAdd
      ? (fn: (x: PlayerDraft) => PlayerDraft) => setAddPlayers((prev) => prev.map((x, idx) => idx === i ? fn(x) : x))
      : (fn: (x: PlayerDraft) => PlayerDraft) => setPlayers((prev) => prev.map((x, idx) => idx === i ? fn(x) : x));
    const remove = isAdd
      ? () => setAddPlayers((prev) => prev.filter((_, idx) => idx !== i))
      : () => setPlayers((prev) => prev.filter((_, idx) => idx !== i));
    const ctxList = isAdd ? "addPlayers" : "players";
    return (
      <SwipeableRow key={i} onDelete={canDelete ? remove : null}>
        <div className="bg-sand/30 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-navy text-sm w-16 shrink-0">ผู้เล่น {i + 1}</span>
            <input value={p.nameOrCode} onChange={(e) => set((x) => ({ ...x, nameOrCode: e.target.value }))}
              placeholder={`ชื่อ/รหัสลูกค้า (ว่าง = Player ${i + 1})`}
              className="flex-1 border border-sand rounded-lg px-3 py-2 text-sm focus:border-orange focus:outline-none" />
            {canDelete && (
              <button type="button" onClick={remove}
                className="w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 text-red-500 font-bold text-sm flex items-center justify-center shrink-0 transition-colors">
                ×
              </button>
            )}
          </div>
          <PackagePicker value={p.pkg}
            onChange={(k) => set((x) => ({ ...x, pkg: k, drinkName: "", drinkPrice: 0, drinkMenuItemId: null }))}
            drinkName={p.drinkName} drinkPrice={p.drinkPrice}
            onOpenDrinkPicker={() => openPickerList({ list: ctxList as "players" | "addPlayers", idx: i })}
            qty={p.qty} onQtyChange={(q) => set((x) => ({ ...x, qty: q }))}
            blockedPkgs={blockedPkgKeys} />
        </div>
      </SwipeableRow>
    );
  }

  // ---- Extra items section ----
  function renderExtraSection(items: ExtraItem[], onChange: (items: ExtraItem[]) => void, ctxList: "extraItems" | "addExtraItems", draftPlayers: PlayerDraft[]) {
    const extraTotal = items.reduce((s, e) => s + e.priceTHB * e.qty, 0);
    return (
      <div className="mt-3 pt-3 border-t border-sand">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-navy">สั่งเพิ่ม (นอกโปร)</p>
          {extraTotal > 0 && <span className="text-xs text-orange font-bold">+฿{extraTotal}</span>}
        </div>
        <ExtraItemsList items={items} onChange={onChange} players={draftPlayers} />
        <button type="button" onClick={() => openPickerList({ list: ctxList })}
          className="w-full mt-2 border border-dashed border-orange/40 text-orange text-xs font-semibold py-2 rounded-xl hover:bg-orange/5 transition-colors">
          🍜 เพิ่มรายการอาหาร/เครื่องดื่ม
        </button>
      </div>
    );
  }

  // ---- Payment method step ----
  function renderMethodStep(total: number, onCash: () => void, onQR: () => void, onBack: () => void, onDefer?: () => void) {
    return (
      <div className="space-y-4">
        <div className="text-center py-2">
          <p className="text-gray-500 text-sm">ยอดรวม</p>
          <p className="text-orange font-bold text-4xl">฿{total}</p>
        </div>
        <p className="text-sm font-semibold text-navy text-center">ลูกค้าเลือกวิธีจ่าย</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onCash} disabled={saving}
            className="flex flex-col items-center gap-2 bg-gray-50 border-2 border-gray-300 hover:border-gray-500 py-5 rounded-2xl transition-all disabled:opacity-50">
            <span className="text-3xl">🧾</span>
            <span className="font-bold text-gray-700 text-sm text-center leading-tight">ชำระที่เคาน์เตอร์</span>
          </button>
          <button onClick={onQR} disabled={saving}
            className="flex flex-col items-center gap-2 bg-blue-50 border-2 border-blue-300 hover:border-blue-500 py-5 rounded-2xl transition-all disabled:opacity-50">
            <span className="text-3xl">📱</span>
            <span className="font-bold text-blue-700 text-sm">สแกน QR</span>
          </button>
        </div>
        {onDefer && (
          <>
            <div className="flex items-center gap-2 text-gray-300">
              <span className="flex-1 h-px bg-gray-200" /><span className="text-xs">หรือ</span><span className="flex-1 h-px bg-gray-200" />
            </div>
            <button onClick={onDefer} disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-orange/10 border-2 border-orange/40 hover:border-orange py-3.5 rounded-2xl transition-all disabled:opacity-50">
              <span className="text-2xl">🧮</span>
              <span className="font-bold text-orange text-sm">เปิดบิลเลย — ให้แคชเชียร์คิดเงิน</span>
            </button>
          </>
        )}
        <button onClick={onBack} className="w-full text-gray-400 text-xs py-1">← ย้อนกลับ</button>
      </div>
    );
  }

  // ---- QR + Slip step ----
  function renderQRStep(qr: { qrDataUrl: string | null; accountName: string; bankName: string }, total: number, file: File | null, preview: string | null, uploading: boolean, inputRef: React.RefObject<HTMLInputElement | null>, onFileChange: (f: File) => void, onSubmit: () => void, onBack: () => void) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-gray-500 text-sm">ยอดรวม</p>
          <p className="text-orange font-bold text-4xl">฿{total}</p>
        </div>
        {qr.qrDataUrl ? (
          <div className="text-center space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.qrDataUrl} alt="QR ชำระเงิน" className="mx-auto w-56 h-56 rounded-xl object-contain" />
            {(qr.accountName || qr.bankName) && (
              <div className="bg-sand/40 rounded-xl py-2 px-4 inline-block">
                <p className="text-navy font-semibold text-sm">{qr.accountName}</p>
                <p className="text-gray-400 text-xs">{qr.bankName}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-400 text-sm">ไม่มี QR (ตั้งค่า PromptPay ID ในหน้า Settings)</p>
        )}
        <div className="border-t border-sand pt-4">
          <p className="text-sm font-semibold text-navy mb-2">อัปโหลดสลิปยืนยัน</p>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { onFileChange(f); } }} />
          {preview ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="สลิป" className="w-full max-h-48 object-contain rounded-xl border border-sand" />
              <button type="button" onClick={() => inputRef.current?.click()} className="w-full text-xs text-orange border border-orange/30 py-2 rounded-xl hover:bg-orange/5">เปลี่ยนรูป</button>
            </div>
          ) : (
            <button type="button" onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-sand text-gray-400 py-6 rounded-xl text-sm hover:border-orange hover:text-orange transition-colors">
              📸 ถ่ายรูป / เลือกสลิป
            </button>
          )}
        </div>
        <button onClick={onSubmit} disabled={!file || uploading}
          className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
          {uploading ? "กำลังอัปโหลด..." : "ยืนยันการชำระเงิน ✓"}
        </button>
        <button onClick={onBack} className="w-full text-gray-400 text-xs py-1">← ย้อนกลับ</button>
      </div>
    );
  }

  // ---- Picker category label ----
  const CAT_LABELS: Record<string, string> = { milktea: "🧋 Milk & Tea", coffee: "☕ Coffee", soda: "🥤 Soda Zaa", drink: "🧊 เครื่องดื่ม", food: "🍜 อาหาร", snack: "🍿 ของทานเล่น", dessert: "🍮 ของหวาน" };
  const isExtraCtx = pickerCtx?.list === "extraItems" || pickerCtx?.list === "addExtraItems";
  const pickerItems = isExtraCtx ? allMenuItems : drinks;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-navy">จัดการเวลา</h1>
        <button onClick={openBillFlow} className="bg-orange hover:bg-orange/90 text-white font-bold px-5 py-2.5 rounded-2xl text-sm shadow-lg transition-colors">+ เปิดบิล</button>
      </div>

      {loading && <p className="text-gray-400 py-8 text-center">กำลังโหลด...</p>}
      {!loading && bills.length === 0 && <p className="text-gray-400 py-12 text-center">ยังไม่มีบิลที่เปิดอยู่ — กด &quot;+ เปิดบิล&quot; เพื่อเริ่ม</p>}

      {/* Bills dashboard */}
      {bills.map((bill) => {
        const colorCfg = BILL_COLORS[bill.color] ?? BILL_COLORS.indigo;
        return (
          <div key={bill.id} className={`bg-gradient-to-br ${colorCfg.gradient} rounded-3xl p-5 shadow-xl`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <button
                  onClick={() => { setEditBill(bill); setEditBillName(bill.name); setEditBillColor(bill.color); }}
                  className="text-white font-bold text-lg hover:underline underline-offset-2 text-left"
                >
                  {bill.name} ✏️
                </button>
                <button onClick={() => setChangeTableBill(bill)} className="block text-white/60 text-xs hover:text-white underline-offset-2 hover:underline">📍 โต๊ะ {bill.table.number} · เปลี่ยน</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openAddToBill(bill)} className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">+ เพิ่มผู้เล่น</button>
                <button onClick={() => closeBill(bill)} className="bg-red-500/80 hover:bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">ปิดบิล</button>
              </div>
            </div>
            {/* Pending counter payment indicator */}
            {bill.pendingCash.map((pc) => {
              let playerSummary = "";
              try {
                const d = JSON.parse(pc.staffNote ?? "");
                playerSummary = d.players?.map((p: { packageType: string; drinkName?: string }) =>
                  `${p.packageType}${p.drinkName ? ` (${p.drinkName})` : ""}`
                ).join(", ") ?? "";
              } catch { /* ignore */ }
              return (
                <div key={pc.orderId} className="bg-yellow-400/20 border border-yellow-400/50 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-yellow-200 text-xs font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                      รอชำระที่เคาน์เตอร์ — ฿{pc.totalTHB}
                    </p>
                    {playerSummary && <p className="text-yellow-300/70 text-[10px] mt-0.5">{playerSummary}</p>}
                  </div>
                  <span className="text-yellow-200/60 text-xs">รหัสออเดอร์ #{pc.orderId}</span>
                </div>
              );
            })}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bill.sessions.map((s) => <SessionCard key={s.id} bill={bill} session={s} prepRemaining={bill.prepRemaining} onCheckout={checkout} onExtend={openExtend} onEdit={openEditSession} />)}
            </div>
          </div>
        );
      })}

      {/* Modal 1: Open Bill */}
      {step === 1 && (
        <Modal onClose={() => setStep(0)} title="เปิดบิล">
          <Field label="ชื่อบิล">
            <input autoFocus value={billName} onChange={(e) => setBillName(e.target.value)} placeholder="เช่น โต๊ะพี่ปลา, กลุ่มวันศุกร์"
              className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none" />
          </Field>
          <Field label="ตำแหน่งโต๊ะ">
            <select value={billTableId ?? ""} onChange={(e) => setBillTableId(Number(e.target.value))}
              className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none bg-white">
              {tables.map((t) => <option key={t.id} value={t.id}>โต๊ะ {t.number}</option>)}
            </select>
          </Field>
          <button onClick={confirmOpenBill} disabled={saving || !billName.trim() || !billTableId}
            className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
            {saving ? "..." : "ยืนยันการเปิดบิล →"}
          </button>
        </Modal>
      )}

      {/* Modal 2: Players + Extra Items */}
      {step === 2 && (
        <Modal onClose={() => setStep(0)} title="ใส่ข้อมูลผู้เล่น" wide>
          <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-3">
            {players.map((p, i) => renderPlayerRow(p, i, false))}
            <button onClick={() => setPlayers((prev) => [...prev, { ...BLANK_DRAFT }])}
              className="w-full border border-dashed border-sand text-gray-500 py-2 rounded-xl text-sm hover:border-orange hover:text-orange">
              + อีกคน
            </button>
            {renderExtraSection(extraItems, setExtraItems, "extraItems", players)}
          </div>
          <button onClick={confirmPlayers} disabled={saving} className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50 mt-2">
            {saving ? "..." : "ยืนยันผู้เล่น →"}
          </button>
        </Modal>
      )}

      {/* Modal 3: Payment Method */}
      {step === 3 && (
        <Modal onClose={closeFlow} title="ชำระเงิน">
          {renderMethodStep(grandTotal(), chooseCash, chooseQR, () => setStep(2), chooseDefer)}
        </Modal>
      )}

      {/* Modal 4: QR + Slip */}
      {step === 4 && orderQr && (
        <Modal onClose={closeFlow} title="สแกน QR ชำระเงิน">
          {renderQRStep(orderQr, grandTotal(), slipFile, slipPreview, slipUploading, slipInputRef,
            (f) => { setSlipFile(f); setSlipPreview(URL.createObjectURL(f)); }, submitSlip, () => setStep(3))}
        </Modal>
      )}

      {/* Add players to existing bill */}
      {addToBill && (
        <Modal onClose={closeAddBillFlow} title={addBillStep === 0 ? `เพิ่มผู้เล่น — ${addToBill.name}` : addBillStep === 1 ? "ชำระเงิน" : "สแกน QR"} wide>
          {addBillStep === 0 && (
            <>
              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                {addPlayers.map((p, i) => renderPlayerRow(p, i, true))}
                <button onClick={() => setAddPlayers((prev) => [...prev, { ...BLANK_DRAFT }])}
                  className="w-full border border-dashed border-sand text-gray-500 py-2 rounded-xl text-sm hover:border-orange hover:text-orange">+ อีกคน</button>
                {renderExtraSection(addExtraItems, setAddExtraItems, "addExtraItems", addPlayers)}
              </div>
              <button onClick={submitAddPlayers} disabled={saving} className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50 mt-2">
                {saving ? "..." : "ยืนยันผู้เล่น →"}
              </button>
            </>
          )}
          {addBillStep === 1 && renderMethodStep(addBillGrandTotal(), chooseAddBillCash, chooseAddBillQR, () => setAddBillStep(0), chooseAddBillDefer)}
          {addBillStep === 2 && addBillQr && renderQRStep(addBillQr, addBillGrandTotal(), addBillSlipFile, addBillSlipPreview, addBillSlipUploading, addBillSlipInputRef,
            (f) => { setAddBillSlipFile(f); setAddBillSlipPreview(URL.createObjectURL(f)); }, submitAddBillSlip, () => setAddBillStep(1))}
        </Modal>
      )}

      {/* Change table */}
      {changeTableBill && (
        <Modal onClose={() => setChangeTableBill(null)} title={`เปลี่ยนโต๊ะ — ${changeTableBill.name}`}>
          <div className="grid grid-cols-3 gap-2">
            {tables.map((t) => (
              <button key={t.id} onClick={() => submitChangeTable(t.id)}
                className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${t.id === changeTableBill.tableId ? "border-orange bg-orange/10 text-navy" : "border-sand text-gray-500 hover:border-orange/50"}`}>
                โต๊ะ {t.number}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Extend time modal */}
      {extendSession && extendStep === 0 && (
        <Modal onClose={closeExtendFlow} title={`ต่อเวลา — ${extendSession.nickname}`}>
          <p className="text-sm text-gray-500 -mt-2">เลือกโปรที่ต้องการต่อเวลา</p>
          <div className="space-y-2">
            {(["A", "B", "D"] as PkgKey[]).map((key) => {
              const blocked = blockedPkgKeys.has(key);
              return (
                <button key={key} disabled={blocked}
                  onClick={() => { if (!blocked) { setExtendPkg(key); setExtendQty(1); setExtendDrinkName(""); setExtendDrinkPrice(0); setExtendDrinkMenuItemId(null); } }}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${blocked ? "border-sand opacity-40 cursor-not-allowed" : extendPkg === key ? "border-orange bg-orange/5" : "border-sand"}`}>
                  <p className="font-bold text-navy text-sm">{PACKAGES[key].label} {blocked ? "— ปิดรับออเดอร์ตอนนี้" : ""}</p>
                  <p className="text-xs text-gray-500">{PACKAGES[key].desc}</p>
                </button>
              );
            })}
          </div>

          {(extendPkg === "A" || extendPkg === "D") && (
            <div>
              <button onClick={() => openPickerList({ list: "extendDrink" })}
                className={`w-full border-2 rounded-xl px-4 py-2.5 text-sm text-left transition-colors ${extendDrinkMenuItemId ? "border-orange bg-orange/5 text-navy font-semibold" : "border-dashed border-sand text-gray-400 hover:border-orange hover:text-orange"}`}>
                {extendDrinkMenuItemId ? `🥤 ${extendDrinkName} (+${extendDrinkPrice}฿)` : `🥤 เลือกเครื่องดื่ม${extendPkg === "A" ? "" : " (ไม่บังคับ)"}`}
              </button>
            </div>
          )}

          {extendPkg === "B" && (
            <div className="flex items-center gap-3 justify-center">
              <button onClick={() => setExtendQty((q) => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-full bg-sand text-navy font-bold text-lg flex items-center justify-center">−</button>
              <span className="font-bold text-navy text-lg w-8 text-center">{extendQty}</span>
              <button onClick={() => setExtendQty((q) => q + 1)}
                className="w-9 h-9 rounded-full bg-sand text-navy font-bold text-lg flex items-center justify-center">+</button>
              <span className="text-sm text-gray-500">= {extendQty * 2} ชม. ({extendQty * PACKAGES.B.price}฿)</span>
            </div>
          )}

          <div className="bg-sand/40 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">ยอดรวม</p>
            <p className="font-bold text-navy text-xl">฿{extendTotal()}</p>
          </div>

          <button onClick={() => setExtendStep(1)}
            disabled={extendPkg === "A" && !extendDrinkMenuItemId}
            className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40">
            ถัดไป — เลือกวิธีชำระ →
          </button>
        </Modal>
      )}

      {extendSession && extendStep === 1 && (
        <Modal onClose={closeExtendFlow} title="ชำระเงิน">
          {renderMethodStep(extendTotal(), chooseExtendCash, chooseExtendQR, () => setExtendStep(0))}
        </Modal>
      )}

      {extendSession && extendStep === 2 && extendQr && (
        <Modal onClose={closeExtendFlow} title="สแกน QR ชำระเงิน">
          {renderQRStep(extendQr, extendTotal(), extendSlipFile, extendSlipPreview, extendSlipUploading, extendSlipRef,
            (f) => { setExtendSlipFile(f); setExtendSlipPreview(URL.createObjectURL(f)); },
            submitExtendSlip, () => setExtendStep(1))}
        </Modal>
      )}

      {/* Item picker — phase 1: list (rendered last so it appears above all other modals) */}
      {pickerCtx && !pickerItem && (
        <Modal onClose={closePickerAll} title={isExtraCtx ? "เลือกรายการ" : "เลือกเครื่องดื่ม"} wide>
          {isExtraCtx ? (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {Object.entries(CAT_LABELS).map(([cat, label]) => {
                const catItems = pickerItems.filter((d) => d.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="text-xs font-bold text-gray-400 mb-2">{label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {catItems.map((d) => {
                        const hasSizes = d.priceS != null || d.priceXL != null;
                        return (
                          <button key={d.id} type="button" onClick={() => setPickerItem(d)}
                            className="text-left bg-sand/30 hover:bg-orange/10 border border-sand hover:border-orange rounded-xl p-3 transition-all">
                            <p className="font-semibold text-navy text-sm leading-tight">{d.nameTh}</p>
                            <p className="text-gray-400 text-xs mt-0.5">{d.nameEn}</p>
                            <p className="text-orange font-bold text-xs mt-1">{hasSizes ? `S ฿${d.priceS} / XL ฿${d.priceXL}` : `฿${d.priceTHB}`}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
              {pickerItems.map((d) => {
                const hasSizes = d.priceS != null || d.priceXL != null;
                return (
                  <button key={d.id} type="button" onClick={() => setPickerItem(d)}
                    className="text-left bg-sand/30 hover:bg-orange/10 border border-sand hover:border-orange rounded-xl p-3 transition-all">
                    <p className="font-semibold text-navy text-sm leading-tight">{d.nameTh}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{d.nameEn}</p>
                    <p className="text-orange font-bold text-xs mt-1">{hasSizes ? `S ฿${d.priceS} / XL ฿${d.priceXL}` : `฿${d.priceTHB}`}</p>
                  </button>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {/* Item picker — phase 2: detail */}
      {pickerCtx && pickerItem && (
        <ItemDetailPicker item={pickerItem} onClose={closePickerAll}
          onConfirm={onItemDetailConfirm}
          confirmLabel={isExtraCtx ? "เพิ่มรายการนี้" : "เลือกเครื่องดื่มนี้"} />
      )}

      {/* Edit bill name + color modal */}
      {editBill && (
        <Modal onClose={() => setEditBill(null)} title="แก้ไขบิล">
          <Field label="ชื่อบิล">
            <input autoFocus value={editBillName} onChange={(e) => setEditBillName(e.target.value)}
              className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none" />
          </Field>
          <Field label="สีบิล">
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(BILL_COLORS).map(([key, cfg]) => (
                <button key={key} onClick={() => setEditBillColor(key)}
                  className={`h-10 rounded-xl bg-gradient-to-br ${cfg.gradient} border-2 transition-all ${editBillColor === key ? "border-orange scale-105" : "border-transparent"}`}
                  title={key} />
              ))}
            </div>
          </Field>
          <button onClick={submitEditBill} disabled={!editBillName.trim()}
            className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
            บันทึก
          </button>
        </Modal>
      )}

      {/* Edit session modal */}
      {editingSession && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-bold text-navy text-lg">แก้ไขผู้เล่น</h3>

            <div>
              <label className="text-xs font-semibold text-navy block mb-1">ชื่อผู้เล่น</label>
              <input
                type="text"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-navy block mb-1">รหัสสมาชิก (ถ้ามี)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editMemberCode}
                  onChange={(e) => setEditMemberCode(e.target.value.toUpperCase())}
                  placeholder="DS-XXXX"
                  className="flex-1 border-2 border-sand rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-orange uppercase"
                />
                <button onClick={() => lookupEditMember(editMemberCode)} disabled={editMemberLoading || !editMemberCode.trim()}
                  className="px-3 py-2 bg-navy text-white text-xs font-semibold rounded-xl disabled:opacity-40">
                  {editMemberLoading ? "..." : "ค้นหา"}
                </button>
              </div>
              {editMemberInfo && (
                <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-700 font-semibold">✅ พบสมาชิก</p>
                    <p className="text-sm font-bold text-navy">{editMemberInfo.firstName} (@{editMemberInfo.username})</p>
                    <p className="text-xs text-gray-400">{editMemberInfo.memberCode}</p>
                  </div>
                  <button onClick={() => { setEditMemberInfo(null); setEditMemberCode(""); }}
                    className="text-gray-300 hover:text-red-400 text-lg">×</button>
                </div>
              )}
              {editMemberError && (
                <p className="text-xs text-red-500 mt-1">{editMemberError}</p>
              )}
              {!editMemberInfo && !editMemberError && editingSession.userId && (
                <p className="text-xs text-gray-400 mt-1">ล้างรหัสสมาชิกเพื่อยกเลิกการลิงค์</p>
              )}
            </div>

            {editMemberInfo && editMemberInfo.id !== editingSession.userId && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700">
                แต้มสะสมและเวลาเล่นจะถูกบันทึกให้สมาชิกนี้เมื่อ check out
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setEditingSession(null)}
                className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm font-semibold">ยกเลิก</button>
              <button onClick={saveEditSession} disabled={editSaving || !editNickname.trim()}
                className="flex-1 bg-orange text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40">
                {editSaving ? "..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash amount input modal */}
      {cashInputOpen && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-4">
            <h3 className="font-bold text-navy text-lg text-center">รับเงินสด</h3>
            <div className="text-center">
              <p className="text-xs text-gray-400">ยอดที่ต้องชำระ</p>
              <p className="text-3xl font-bold text-orange">฿{cashInputTotal.toLocaleString()}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-navy block mb-1">ลูกค้าจ่ายมา</label>
              <input
                type="number"
                inputMode="numeric"
                autoFocus
                value={cashInputStr}
                onChange={(e) => setCashInputStr(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmCashInput(); }}
                placeholder="0"
                className="w-full border-2 border-sand rounded-xl px-4 py-3 text-2xl font-bold text-navy text-center focus:outline-none focus:border-orange"
              />
            </div>
            {cashInputStr && (
              <div className={`rounded-xl p-3 text-center ${parseInt(cashInputStr) >= cashInputTotal ? "bg-green-50" : "bg-red-50"}`}>
                {parseInt(cashInputStr) >= cashInputTotal ? (
                  <>
                    <p className="text-xs text-green-600">เงินทอน</p>
                    <p className="text-3xl font-bold text-green-700">฿{(parseInt(cashInputStr) - cashInputTotal).toLocaleString()}</p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-red-500">ยอดไม่เพียงพอ — ขาดอีก ฿{(cashInputTotal - parseInt(cashInputStr)).toLocaleString()}</p>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {[20, 50, 100, 500, 1000].map((amt) => (
                <button key={amt} type="button"
                  onClick={() => setCashInputStr(String((parseInt(cashInputStr) || 0) + amt))}
                  className="bg-sand/50 hover:bg-orange/10 border border-sand text-navy text-sm font-semibold py-2 rounded-xl">
                  +{amt}
                </button>
              ))}
              <button type="button"
                onClick={() => setCashInputStr("")}
                className="bg-sand/50 hover:bg-red-50 border border-sand text-gray-400 text-sm py-2 rounded-xl">
                ล้าง
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCashInputOpen(false)} className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm font-semibold">ยกเลิก</button>
              <button onClick={confirmCashInput} disabled={saving || !cashInputStr || parseInt(cashInputStr) < cashInputTotal}
                className="flex-1 bg-green-600 text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40">
                {saving ? "..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Reusable components ----
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-3xl p-6 w-full ${wide ? "max-w-2xl" : "max-w-sm"} shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-navy text-lg">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function SwipeableRow({ children, onDelete }: { children: React.ReactNode; onDelete: (() => void) | null }) {
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const REVEAL = 72;
  const THRESHOLD = 36;

  function handleTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX;
    setDragging(true);
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (!onDelete) return;
    const dx = e.touches[0].clientX - startXRef.current;
    setOffsetX(Math.min(0, Math.max(-REVEAL, dx)));
  }
  function handleTouchEnd() {
    setDragging(false);
    if (!onDelete) return;
    if (offsetX < -THRESHOLD) setOffsetX(-REVEAL);
    else setOffsetX(0);
  }

  const transition = dragging ? "none" : "transform 0.2s ease";

  return (
    <div className="overflow-hidden rounded-xl">
      <div className="relative flex">
        {/* Sliding card content */}
        <div
          className="w-full shrink-0"
          style={{ transform: `translateX(${offsetX}px)`, transition }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {children}
        </div>
        {/* Delete button slides in from the right together with the card */}
        {onDelete && (
          <div
            className="absolute right-0 top-0 bottom-0 w-[72px] bg-red-500 flex flex-col items-center justify-center gap-0.5 rounded-r-xl"
            style={{ transform: `translateX(${REVEAL + offsetX}px)`, transition }}
          >
            <button type="button" onClick={() => { onDelete(); setOffsetX(0); }} className="w-full h-full flex flex-col items-center justify-center gap-0.5">
              <span className="text-xl">🗑️</span>
              <span className="text-white text-[10px] font-bold">ลบ</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-navy block mb-1">{label}</label>
      {children}
    </div>
  );
}
