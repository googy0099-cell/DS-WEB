"use client";

import { useEffect, useState, useCallback } from "react";
import type { MenuItemType, CartSelectedAddon, CartSelectedOption } from "@/types";

type MemberRef = { id: number; username: string; memberCode: string };
type PlayerSession = {
  id: number;
  nickname: string;
  packageType: string;
  packagePrice: number;
  timeRemaining: number;
  status: string;
  updatedAt: string;
  userId: number | null;
  user: MemberRef | null;
};
type Bill = {
  id: number;
  name: string;
  tableId: number;
  startsAt: string;
  prepRemaining: number;
  table: { number: number };
  sessions: PlayerSession[];
};
type TableRef = { id: number; number: number };
type DrinkItem = MenuItemType;

const PACKAGES: Record<string, { label: string; price: number; timeSeconds: number; desc: string }> = {
  A: { label: "Package A", price: 0, timeSeconds: 3600, desc: "สั่งเครื่องดื่ม — เล่นฟรี 1 ชม." },
  B: { label: "Package B", price: 49, timeSeconds: 7200, desc: "49฿ — เล่น 2 ชม." },
  C: { label: "Package C", price: 120, timeSeconds: 86400, desc: "120฿ — เหมาวัน + ฟรีเครื่องดื่ม" },
};
const DRINK_CATS = ["coffee", "milktea", "soda"];
const PKG_KEYS = ["A", "B", "C"] as const;
type PkgKey = (typeof PKG_KEYS)[number];

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
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timerColor(secs: number) {
  if (secs >= 86400) return { bar: "bg-purple-400", text: "text-purple-300", label: "∞" };
  if (secs > 600) return { bar: "bg-green-400", text: "text-green-400", label: "ปกติ" };
  if (secs > 0) return { bar: "bg-yellow-400", text: "text-yellow-400", label: "ใกล้หมด" };
  return { bar: "bg-red-500", text: "text-red-400", label: "หมดเวลา!" };
}

// ---- Session Card ----
function SessionCard({
  session,
  prepRemaining,
  onCheckout,
  onAddTime,
}: {
  session: PlayerSession;
  prepRemaining: number;
  onCheckout: (id: number) => void;
  onAddTime: (id: number, secs: number) => void;
}) {
  const prep = useCountdown(prepRemaining);
  const remaining = useCountdown(session.timeRemaining);
  const inPrep = prep > 0;
  const color = timerColor(remaining);
  const maxTime = PACKAGES[session.packageType]?.timeSeconds ?? 3600;
  const pct = remaining >= 86400 ? 100 : Math.min(100, (remaining / maxTime) * 100);

  return (
    <div className="bg-navy/80 rounded-2xl p-4 space-y-3 border border-white/10">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-white text-base">{session.nickname}</p>
          <p className="text-white/50 text-xs">{PACKAGES[session.packageType]?.desc}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${inPrep ? "text-sky-300" : color.text} border border-current`}>
          {inPrep ? "เตรียมตัว" : color.label}
        </span>
      </div>

      {session.user && (
        <div className="bg-green-500/15 border border-green-400/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <span className="text-sm">🎯</span>
          <span className="text-green-300 text-xs font-semibold">เก็บแต้มให้ {session.user.username}</span>
        </div>
      )}

      {inPrep ? (
        <div>
          <div className="text-2xl font-mono font-bold text-sky-300">เริ่มใน {fmt(prep)}</div>
          <p className="text-white/40 text-xs mt-1">เวลาเล่น {fmt(session.timeRemaining)} (ยังไม่เริ่มนับ)</p>
        </div>
      ) : (
        <div>
          <div className={`text-2xl font-mono font-bold ${color.text}`}>{fmt(remaining)}</div>
          <div className="mt-1.5 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${color.bar}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onAddTime(session.id, 3600)}
          className="flex-1 text-xs bg-white/10 hover:bg-white/20 text-white font-semibold py-2 rounded-xl transition-colors"
          title="สั่งน้ำเพิ่ม → เพิ่มเวลา 1 ชั่วโมง"
        >
          🥤 +1 ชม.
        </button>
        <button
          onClick={() => onCheckout(session.id)}
          className="flex-1 text-xs bg-orange hover:bg-orange/80 text-white font-bold py-2 rounded-xl transition-colors"
        >
          ปิด
        </button>
      </div>
    </div>
  );
}

// ---- Package picker (context-aware) ----
function PackagePicker({
  value, onChange,
  drinkName, drinkPrice, onOpenDrinkPicker,
  qty, onQtyChange,
}: {
  value: PkgKey; onChange: (k: PkgKey) => void;
  drinkName: string; drinkPrice: number; onOpenDrinkPicker: () => void;
  qty: number; onQtyChange: (q: number) => void;
}) {
  const totalPrice = value === "B" ? PACKAGES.B.price * qty : PACKAGES[value].price + (value === "A" ? drinkPrice : 0);
  const totalHours = value === "B" ? 2 * qty : value === "A" ? 1 : "∞";

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {PKG_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold border-2 transition-all ${
              value === k ? "border-orange bg-orange/10 text-navy" : "border-sand text-gray-400 hover:border-orange/40"
            }`}
            title={PACKAGES[k].desc}
          >
            {k}
            <span className="block text-[10px] font-normal">
              {PACKAGES[k].price === 0 ? "ฟรี" : `฿${PACKAGES[k].price}`}
            </span>
          </button>
        ))}
      </div>

      {(value === "A" || value === "C") && (
        <button
          type="button"
          onClick={onOpenDrinkPicker}
          className={`w-full text-left text-xs border-2 rounded-lg px-3 py-2 transition-all ${
            drinkName
              ? "border-orange bg-orange/5 text-navy"
              : "border-sand text-gray-400 hover:border-orange/40"
          }`}
        >
          {drinkName ? (
            <span className="flex items-center justify-between">
              <span>🥤 {drinkName}</span>
              <span className="text-orange font-semibold">
                {value === "A" ? `฿${drinkPrice}` : "รวมแล้ว"} · เปลี่ยน
              </span>
            </span>
          ) : (
            "🥤 เลือกเครื่องดื่ม →"
          )}
        </button>
      )}
      {value === "A" && drinkName && (
        <p className="text-[10px] text-orange font-semibold pl-1">1ชม. ฟรี + เครื่องดื่ม ฿{drinkPrice}</p>
      )}

      {value === "B" && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onQtyChange(Math.max(1, qty - 1))}
            className="w-6 h-6 rounded-full bg-sand hover:bg-orange/20 text-navy font-bold text-sm flex items-center justify-center"
          >−</button>
          <span className="text-xs font-bold text-navy w-4 text-center">{qty}</span>
          <button
            type="button"
            onClick={() => onQtyChange(qty + 1)}
            className="w-6 h-6 rounded-full bg-sand hover:bg-orange/20 text-navy font-bold text-sm flex items-center justify-center"
          >+</button>
          <span className="text-[10px] text-gray-400">{totalHours}ชม. · ฿{totalPrice}</span>
        </div>
      )}
    </div>
  );
}

type PlayerDraft = { nameOrCode: string; pkg: PkgKey; drinkName: string; drinkPrice: number; qty: number };

const BLANK_DRAFT: PlayerDraft = { nameOrCode: "", pkg: "A", drinkName: "", drinkPrice: 0, qty: 1 };

// ---- Main Page ----
export default function AdminTimePage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [tables, setTables] = useState<TableRef[]>([]);
  const [drinks, setDrinks] = useState<DrinkItem[]>([]);
  const [loading, setLoading] = useState(true);

  // open-bill flow
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0); // 0 closed, 1 bill, 2 players, 3 payment
  const [billName, setBillName] = useState("");
  const [billTableId, setBillTableId] = useState<number | null>(null);
  const [peopleCount, setPeopleCount] = useState(1);
  const [draftBillId, setDraftBillId] = useState<number | null>(null);
  const [players, setPlayers] = useState<PlayerDraft[]>([]);
  const [payment, setPayment] = useState<{ totalTHB: number; qrDataUrl: string | null; accountName: string; bankName: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // per-bill add player / change table
  const [addToBill, setAddToBill] = useState<Bill | null>(null);
  const [addPlayers, setAddPlayers] = useState<PlayerDraft[]>([{ ...BLANK_DRAFT }]);
  const [changeTableBill, setChangeTableBill] = useState<Bill | null>(null);

  // drink picker modal (shared for both flows)
  type DrinkPickerCtx = { list: "players" | "addPlayers"; idx: number };
  const [drinkPickerCtx, setDrinkPickerCtx] = useState<DrinkPickerCtx | null>(null);
  const [drinkPickerItem, setDrinkPickerItem] = useState<DrinkItem | null>(null);
  const [drinkPickerSize, setDrinkPickerSize] = useState<"S" | "XL">("S");
  const [drinkPickerAddons, setDrinkPickerAddons] = useState<CartSelectedAddon[]>([]);
  const [drinkPickerOptions, setDrinkPickerOptions] = useState<CartSelectedOption[]>([]);

  const load = useCallback(async () => {
    const [b, t, m] = await Promise.all([
      fetch("/api/pos/bills").then((r) => r.json()).catch(() => []),
      fetch("/api/tables").then((r) => r.json()).catch(() => []),
      fetch("/api/menu").then((r) => r.json()).catch(() => []),
    ]);
    setBills(Array.isArray(b) ? b : []);
    setTables(Array.isArray(t) ? t : []);
    setDrinks(
      Array.isArray(m)
        ? (m as DrinkItem[]).filter((item) => DRINK_CATS.includes(item.category))
        : []
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  function openDrinkPicker(ctx: { list: "players" | "addPlayers"; idx: number }, item: DrinkItem) {
    setDrinkPickerCtx(ctx);
    setDrinkPickerItem(item);
    setDrinkPickerSize("S");
    setDrinkPickerAddons([]);
    const defaults: CartSelectedOption[] = [];
    for (const og of item.optionGroups) {
      const def = og.choices.find((c) => c.isDefault && c.isActive);
      if (def) defaults.push({ groupId: og.id, groupName: og.nameTh, choiceId: def.id, choiceName: def.nameTh, priceTHB: def.priceTHB });
    }
    setDrinkPickerOptions(defaults);
  }

  function closeDrinkPicker() {
    setDrinkPickerCtx(null);
    setDrinkPickerItem(null);
    setDrinkPickerAddons([]);
    setDrinkPickerOptions([]);
  }

  function confirmDrinkPicker() {
    if (!drinkPickerCtx || !drinkPickerItem) return;
    const hasSizes = drinkPickerItem.priceS != null || drinkPickerItem.priceXL != null;
    let basePrice = drinkPickerItem.priceTHB;
    if (hasSizes && drinkPickerSize === "S" && drinkPickerItem.priceS != null) basePrice = drinkPickerItem.priceS;
    if (hasSizes && drinkPickerSize === "XL" && drinkPickerItem.priceXL != null) basePrice = drinkPickerItem.priceXL;
    const addonTotal = drinkPickerAddons.reduce((s, a) => s + a.priceTHB, 0);
    const optionTotal = drinkPickerOptions.reduce((s, o) => s + o.priceTHB, 0);
    const totalPrice = basePrice + addonTotal + optionTotal;
    const sizeLabel = hasSizes ? ` (${drinkPickerSize})` : "";
    const addonLabels = drinkPickerAddons.map((a) => a.nameTh).join(", ");
    const optionLabels = drinkPickerOptions.map((o) => o.choiceName).join(", ");
    const extras = [addonLabels, optionLabels].filter(Boolean).join(", ");
    const fullName = `${drinkPickerItem.nameTh}${sizeLabel}${extras ? ` + ${extras}` : ""}`;

    if (drinkPickerCtx.list === "players") {
      setPlayers((prev) => prev.map((x, idx) => idx === drinkPickerCtx.idx ? { ...x, drinkName: fullName, drinkPrice: totalPrice } : x));
    } else {
      setAddPlayers((prev) => prev.map((x, idx) => idx === drinkPickerCtx.idx ? { ...x, drinkName: fullName, drinkPrice: totalPrice } : x));
    }
    closeDrinkPicker();
  }

  function openBillFlow() {
    setBillName("");
    setBillTableId(tables[0]?.id ?? null);
    setPeopleCount(1);
    setDraftBillId(null);
    setPlayers([]);
    setPayment(null);
    setStep(1);
  }

  async function confirmOpenBill() {
    if (!billName.trim() || !billTableId) return;
    setSaving(true);
    const res = await fetch("/api/pos/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: billName.trim(), tableId: billTableId }),
    });
    setSaving(false);
    if (!res.ok) { window.alert("เปิดบิลไม่สำเร็จ"); return; }
    const bill = await res.json();
    setDraftBillId(bill.id);
    setPlayers(Array.from({ length: peopleCount }, () => ({ ...BLANK_DRAFT })));
    setStep(2);
  }

  async function confirmPlayers() {
    if (!draftBillId) return;
    setSaving(true);
    const res = await fetch(`/api/pos/bills/${draftBillId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: players.map((p) => ({ nameOrCode: p.nameOrCode, packageType: p.pkg, drinkName: p.drinkName, drinkPrice: p.drinkPrice, qty: p.qty })) }),
    });
    setSaving(false);
    if (!res.ok) { window.alert("บันทึกผู้เล่นไม่สำเร็จ"); return; }
    const data = await res.json();
    setPayment({ totalTHB: data.totalTHB, qrDataUrl: data.qrDataUrl, accountName: data.accountName ?? "", bankName: data.bankName ?? "" });
    setStep(3);
    load();
  }

  function closeFlow() {
    setStep(0);
    setPayment(null);
    load();
  }

  async function checkout(sessionId: number) {
    if (!confirm("ปิดผู้เล่นคนนี้? (ถ้าผูกสมาชิกจะเก็บแต้มชั่วโมงให้)")) return;
    await fetch(`/api/pos/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    });
    load();
  }

  async function addTime(sessionId: number, seconds: number) {
    await fetch(`/api/pos/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addSeconds: seconds }),
    });
    load();
  }

  async function closeBill(bill: Bill) {
    if (!confirm(`ปิดบิล "${bill.name}" ทั้งหมด?`)) return;
    await fetch(`/api/pos/bills/${bill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" }),
    });
    load();
  }

  async function submitAddPlayers() {
    if (!addToBill) return;
    setSaving(true);
    await fetch(`/api/pos/bills/${addToBill.id}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: addPlayers.map((p) => ({ nameOrCode: p.nameOrCode, packageType: p.pkg, drinkName: p.drinkName, drinkPrice: p.drinkPrice, qty: p.qty })) }),
    });
    setSaving(false);
    setAddToBill(null);
    setAddPlayers([{ ...BLANK_DRAFT }]);
    load();
  }

  async function submitChangeTable(tableId: number) {
    if (!changeTableBill) return;
    await fetch(`/api/pos/bills/${changeTableBill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId }),
    });
    setChangeTableBill(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-navy">จัดการเวลา</h1>
        <button
          onClick={openBillFlow}
          className="bg-orange hover:bg-orange/90 text-white font-bold px-5 py-2.5 rounded-2xl text-sm shadow-lg transition-colors"
        >
          + เปิดบิล
        </button>
      </div>

      {loading && <p className="text-gray-400 py-8 text-center">กำลังโหลด...</p>}
      {!loading && bills.length === 0 && (
        <p className="text-gray-400 py-12 text-center">ยังไม่มีบิลที่เปิดอยู่ — กด &quot;+ เปิดบิล&quot; เพื่อเริ่ม</p>
      )}

      {/* Bills */}
      {bills.map((bill) => (
        <div key={bill.id} className="bg-gradient-to-br from-navy to-indigo-900 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-white font-bold text-lg">{bill.name}</h2>
              <button
                onClick={() => setChangeTableBill(bill)}
                className="text-white/60 text-xs hover:text-white underline-offset-2 hover:underline"
              >
                📍 โต๊ะ {bill.table.number} · เปลี่ยน
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setAddToBill(bill); setAddPlayers([{ ...BLANK_DRAFT }]); }}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                + เพิ่มผู้เล่น
              </button>
              <button
                onClick={() => closeBill(bill)}
                className="bg-red-500/80 hover:bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                ปิดบิล
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bill.sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                prepRemaining={bill.prepRemaining}
                onCheckout={checkout}
                onAddTime={addTime}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Modal 1: Open Bill */}
      {step === 1 && (
        <Modal onClose={() => setStep(0)} title="เปิดบิล">
          <Field label="ชื่อบิล">
            <input
              autoFocus
              value={billName}
              onChange={(e) => setBillName(e.target.value)}
              placeholder="เช่น โต๊ะพี่ปลา, กลุ่มวันศุกร์"
              className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none"
            />
          </Field>
          <Field label="ตำแหน่งโต๊ะ">
            <select
              value={billTableId ?? ""}
              onChange={(e) => setBillTableId(Number(e.target.value))}
              className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none bg-white"
            >
              {tables.map((t) => (
                <option key={t.id} value={t.id}>โต๊ะ {t.number}</option>
              ))}
            </select>
          </Field>
          <Field label="จำนวนคน">
            <select
              value={peopleCount}
              onChange={(e) => setPeopleCount(Number(e.target.value))}
              className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none bg-white"
            >
              {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n} คน</option>
              ))}
            </select>
          </Field>
          <button
            onClick={confirmOpenBill}
            disabled={saving || !billName.trim() || !billTableId}
            className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50"
          >
            {saving ? "..." : "ยืนยันการเปิดบิล →"}
          </button>
        </Modal>
      )}

      {/* Modal 2: Players */}
      {step === 2 && (
        <Modal onClose={() => setStep(0)} title="ใส่ข้อมูลผู้เล่น" wide>
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {players.map((p, i) => (
              <div key={i} className="bg-sand/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-navy text-sm w-16 shrink-0">ผู้เล่น {i + 1}</span>
                  <input
                    value={p.nameOrCode}
                    onChange={(e) => setPlayers((prev) => prev.map((x, idx) => idx === i ? { ...x, nameOrCode: e.target.value } : x))}
                    placeholder={`ชื่อ/รหัสลูกค้า (ไม่ใส่ = Player ${i + 1})`}
                    className="flex-1 border border-sand rounded-lg px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
                <PackagePicker
                  value={p.pkg}
                  onChange={(k) => setPlayers((prev) => prev.map((x, idx) => idx === i ? { ...x, pkg: k, drinkName: "", drinkPrice: 0 } : x))}
                  drinkName={p.drinkName}
                  drinkPrice={p.drinkPrice}
                  onOpenDrinkPicker={() => setDrinkPickerCtx({ list: "players", idx: i })}
                  qty={p.qty}
                  onQtyChange={(q) => setPlayers((prev) => prev.map((x, idx) => idx === i ? { ...x, qty: q } : x))}
                />
              </div>
            ))}
          </div>
          <button
            onClick={confirmPlayers}
            disabled={saving}
            className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50 mt-2"
          >
            {saving ? "..." : "ยืนยันผู้เล่น →"}
          </button>
        </Modal>
      )}

      {/* Modal 3: Payment */}
      {step === 3 && payment && (
        <Modal onClose={closeFlow} title="ค่าใช้จ่าย">
          <div className="text-center space-y-3">
            <p className="text-gray-500 text-sm">ยอดรวม</p>
            <p className="text-orange font-bold text-4xl">฿{payment.totalTHB}</p>
            {payment.qrDataUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={payment.qrDataUrl} alt="QR ชำระเงิน" className="mx-auto w-56 h-56 rounded-xl object-contain" />
                {(payment.accountName || payment.bankName) && (
                  <div className="bg-sand/40 rounded-xl py-2 px-4 inline-block">
                    <p className="text-navy font-semibold text-sm">{payment.accountName}</p>
                    <p className="text-gray-400 text-xs">{payment.bankName}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-green-600 font-semibold py-6">ไม่มีค่าใช้จ่าย (ฟรี)</p>
            )}
            <button onClick={closeFlow} className="w-full bg-navy text-white font-bold py-3 rounded-2xl text-sm">
              เสร็จสิ้น
            </button>
          </div>
        </Modal>
      )}

      {/* Add players to existing bill */}
      {addToBill && (
        <Modal onClose={() => setAddToBill(null)} title={`เพิ่มผู้เล่น — ${addToBill.name}`} wide>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {addPlayers.map((p, i) => (
              <div key={i} className="bg-sand/30 rounded-xl p-3 space-y-2">
                <input
                  value={p.nameOrCode}
                  onChange={(e) => setAddPlayers((prev) => prev.map((x, idx) => idx === i ? { ...x, nameOrCode: e.target.value } : x))}
                  placeholder="ชื่อ/รหัสลูกค้า"
                  className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:border-orange focus:outline-none"
                />
                <PackagePicker
                  value={p.pkg}
                  onChange={(k) => setAddPlayers((prev) => prev.map((x, idx) => idx === i ? { ...x, pkg: k, drinkName: "", drinkPrice: 0 } : x))}
                  drinkName={p.drinkName}
                  drinkPrice={p.drinkPrice}
                  onOpenDrinkPicker={() => setDrinkPickerCtx({ list: "addPlayers", idx: i })}
                  qty={p.qty}
                  onQtyChange={(q) => setAddPlayers((prev) => prev.map((x, idx) => idx === i ? { ...x, qty: q } : x))}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => setAddPlayers((prev) => [...prev, { ...BLANK_DRAFT }])}
            className="w-full border border-dashed border-sand text-gray-500 py-2 rounded-xl text-sm hover:border-orange hover:text-orange"
          >
            + อีกคน
          </button>
          <button
            onClick={submitAddPlayers}
            disabled={saving}
            className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50"
          >
            {saving ? "..." : "เพิ่มเข้าบิล"}
          </button>
        </Modal>
      )}

      {/* Drink picker — phase 1: list, phase 2: detail */}
      {drinkPickerCtx && !drinkPickerItem && (
        <Modal onClose={closeDrinkPicker} title="เลือกเครื่องดื่ม" wide>
          <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {drinks.map((d) => {
              const hasSizes = d.priceS != null || d.priceXL != null;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => openDrinkPicker(drinkPickerCtx, d)}
                  className="text-left bg-sand/30 hover:bg-orange/10 border border-sand hover:border-orange rounded-xl p-3 transition-all"
                >
                  <p className="font-semibold text-navy text-sm leading-tight">{d.nameTh}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{d.nameEn}</p>
                  <p className="text-orange font-bold text-xs mt-1">
                    {hasSizes ? `S ฿${d.priceS} / XL ฿${d.priceXL}` : `฿${d.priceTHB}`}
                  </p>
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {drinkPickerCtx && drinkPickerItem && (() => {
        const item = drinkPickerItem;
        const hasSizes = item.priceS != null || item.priceXL != null;
        let basePrice = item.priceTHB;
        if (hasSizes && drinkPickerSize === "S" && item.priceS != null) basePrice = item.priceS;
        if (hasSizes && drinkPickerSize === "XL" && item.priceXL != null) basePrice = item.priceXL;
        const total = basePrice + drinkPickerAddons.reduce((s, a) => s + a.priceTHB, 0) + drinkPickerOptions.reduce((s, o) => s + o.priceTHB, 0);

        return (
          <Modal onClose={closeDrinkPicker} title={item.nameTh}>
            <p className="text-xs text-gray-400 -mt-2 mb-3">{item.nameEn}</p>

            {hasSizes && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-navy mb-2">เลือกขนาด</p>
                <div className="flex gap-3">
                  {item.priceS != null && (
                    <button type="button" onClick={() => setDrinkPickerSize("S")}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${drinkPickerSize === "S" ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"}`}>
                      S — ฿{item.priceS}
                    </button>
                  )}
                  {item.priceXL != null && (
                    <button type="button" onClick={() => setDrinkPickerSize("XL")}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${drinkPickerSize === "XL" ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"}`}>
                      XL — ฿{item.priceXL}
                    </button>
                  )}
                </div>
              </div>
            )}

            {item.addonGroups.map((group) => (
              <div key={group.id} className="mb-4">
                <p className="text-sm font-semibold text-navy mb-2">{group.nameTh}</p>
                <div className="space-y-2">
                  {group.items.filter((gi) => gi.isActive).map((addonItem) => {
                    const selected = drinkPickerAddons.some((a) => a.id === addonItem.id);
                    return (
                      <button key={addonItem.id} type="button"
                        onClick={() => setDrinkPickerAddons((prev) => selected ? prev.filter((a) => a.id !== addonItem.id) : [...prev, { id: addonItem.id, groupId: group.id, nameTh: addonItem.nameTh, priceTHB: addonItem.priceTHB }])}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${selected ? "border-orange bg-orange/10" : "border-sand"}`}>
                        <span className={`text-sm font-medium flex items-center gap-1.5 ${selected ? "text-orange" : "text-navy"}`}>
                          {selected && <span>✓</span>}{addonItem.nameTh}
                        </span>
                        <span className="text-sm text-gray-500">+฿{addonItem.priceTHB}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {item.optionGroups.map((group) => {
              const selected = drinkPickerOptions.find((o) => o.groupId === group.id);
              return (
                <div key={group.id} className="mb-4">
                  <p className="text-sm font-semibold text-navy mb-2 flex items-center gap-2">
                    {group.nameTh}
                    {group.isRequired && <span className="text-xs text-orange font-normal">*บังคับ</span>}
                  </p>
                  <div className="space-y-2">
                    {!group.isRequired && (
                      <button type="button"
                        onClick={() => setDrinkPickerOptions((prev) => prev.filter((o) => o.groupId !== group.id))}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${!selected ? "border-orange bg-orange/10" : "border-sand"}`}>
                        <span className={`text-sm font-medium ${!selected ? "text-orange" : "text-navy"}`}>{!selected && "✓ "}ไม่ระบุ</span>
                        <span className="text-sm text-gray-400">ฟรี</span>
                      </button>
                    )}
                    {group.choices.filter((c) => c.isActive).map((choice) => {
                      const isSelected = selected?.choiceId === choice.id;
                      return (
                        <button key={choice.id} type="button"
                          onClick={() => setDrinkPickerOptions((prev) => [...prev.filter((o) => o.groupId !== group.id), { groupId: group.id, groupName: group.nameTh, choiceId: choice.id, choiceName: choice.nameTh, priceTHB: choice.priceTHB }])}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${isSelected ? "border-orange bg-orange/10" : "border-sand"}`}>
                          <span className={`text-sm font-medium ${isSelected ? "text-orange" : "text-navy"}`}>{isSelected && "✓ "}{choice.nameTh}</span>
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
            <button type="button" onClick={confirmDrinkPicker}
              className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm">
              เลือกเครื่องดื่มนี้
            </button>
          </Modal>
        );
      })()}

      {/* Change table */}
      {changeTableBill && (
        <Modal onClose={() => setChangeTableBill(null)} title={`เปลี่ยนโต๊ะ — ${changeTableBill.name}`}>
          <div className="grid grid-cols-3 gap-2">
            {tables.map((t) => (
              <button
                key={t.id}
                onClick={() => submitChangeTable(t.id)}
                className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                  t.id === changeTableBill.tableId ? "border-orange bg-orange/10 text-navy" : "border-sand text-gray-500 hover:border-orange/50"
                }`}
              >
                โต๊ะ {t.number}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---- Reusable Modal + Field ----
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-3xl p-6 w-full ${wide ? "max-w-2xl" : "max-w-sm"} shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-navy text-lg">{title}</h3>
        {children}
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
