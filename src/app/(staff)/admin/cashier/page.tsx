"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NumpadInput from "@/components/admin/NumpadInput";

type LowMenu = { id: number; nameTh: string; missing: string[] };
type ReorderItem = { id: number; sku: string; name: string; unit: string; currentQty: number; reorderQty: number };
type CashExpense = { id: number; type: string; amount: number; description: string; photoUrl: string | null; note: string | null; reimbursed: boolean; createdAt: string };

const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5, 2, 1];

interface Payment {
  id: number;
  method: string;
  amountTHB: number;
  receivedAmount: number | null;
  changeAmount: number | null;
  confirmedAt: string;
  order: { id: number; orderName: string; totalTHB: number };
}

interface Summary {
  date: string;
  cashTotal: number;
  transferTotal: number;
  grandTotal: number;
  cashPayments: Payment[];
  transferPayments: Payment[];
  ordersTotal: number;
  ordersCount: number;
  gametimeTotal: number;
  gametimeCount: number;
  pettyExpenses: CashExpense[];
  pettyTotal: number;
  advanceTotal: number;
  lastClose: {
    id: number;
    date: string;
    openingFloat: number;
    expectedCash: number;
    totalTransfer: number;
    countedCash: number;
    difference: number;
    note: string | null;
    createdAt: string;
  } | null;
}

type ShiftState = "CLOSED" | "OPEN" | "CLOSING";
type CloseStep = 1 | 2 | 3 | 4; // 1=summary 2=count 3=compare 4=done

const SHIFT_KEY = () => `shift_${new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)}`;

function formatTime(iso: string) {
  const d = new Date(iso);
  const bkk = new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60_000);
  return `${String(bkk.getHours()).padStart(2, "0")}:${String(bkk.getMinutes()).padStart(2, "0")}`;
}

function formatThaiDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

function elapsed(since: string): string {
  const ms = Date.now() - new Date(since).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function CashierPage() {
  const [shiftState, setShiftState] = useState<ShiftState>("CLOSED");
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [openingFloat, setOpeningFloat] = useState("0");
  const [timer, setTimer] = useState("00:00");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expType, setExpType] = useState<"PETTY_CASH" | "STAFF_ADVANCE">("PETTY_CASH");
  const [expAmount, setExpAmount] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expNote, setExpNote] = useState("");
  const [expPhoto, setExpPhoto] = useState<string | null>(null);
  const [expUploading, setExpUploading] = useState(false);
  const [expSaving, setExpSaving] = useState(false);

  // Expense detail modal
  const [detailExpense, setDetailExpense] = useState<CashExpense | null>(null);

  const [closeStep, setCloseStep] = useState<CloseStep>(1);
  const [counts, setCounts] = useState<Record<number, string>>(
    Object.fromEntries(DENOMINATIONS.map((d) => [d, ""]))
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Stock checks
  const [lowMenus, setLowMenus] = useState<LowMenu[] | null>(null);
  const [stockCheckLoading, setStockCheckLoading] = useState(false);
  const [reorderItems, setReorderItems] = useState<ReorderItem[]>([]);

  // Restore today's shift — cross-device: validate localStorage against server
  useEffect(() => {
    const stored = localStorage.getItem(SHIFT_KEY());
    fetch("/api/shop/status")
      .then((r) => r.json())
      .then(({ isOpen }: { isOpen: boolean }) => {
        if (stored && isOpen) {
          // Both local and server say open → restore
          const { openedAt: oa, openingFloat: of_ } = JSON.parse(stored);
          setOpenedAt(oa);
          setOpeningFloat(String(of_));
          setShiftState("OPEN");
        } else if (stored && !isOpen) {
          // Server says closed but localStorage still has it → another device closed
          localStorage.removeItem(SHIFT_KEY());
          setShiftState("CLOSED");
        }
        // If no stored → stay CLOSED (default)
      })
      .catch(() => {
        // Network error — fall back to localStorage
        if (stored) {
          const { openedAt: oa, openingFloat: of_ } = JSON.parse(stored);
          setOpenedAt(oa);
          setOpeningFloat(String(of_));
          setShiftState("OPEN");
        }
      });
  }, []);

  // Live timer + periodic cross-device sync
  useEffect(() => {
    if (shiftState !== "OPEN" || !openedAt) return;
    const tick = () => setTimer(elapsed(openedAt));
    tick();
    const timerId = setInterval(tick, 30_000);
    // Re-check server state every 60s — catches shift closed on another device
    const syncId = setInterval(() => {
      fetch("/api/shop/status")
        .then((r) => r.json())
        .then(({ isOpen }: { isOpen: boolean }) => {
          if (!isOpen) {
            localStorage.removeItem(SHIFT_KEY());
            setShiftState("CLOSED");
            setOpenedAt(null);
          }
        })
        .catch(() => {});
    }, 60_000);
    return () => { clearInterval(timerId); clearInterval(syncId); };
  }, [shiftState, openedAt]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const data = await fetch("/api/cashier/summary").then((r) => r.json());
      setSummary(data);
    } catch {
      // fail silently — summary stays null, UI shows empty values
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  async function handleOpenClick() {
    setStockCheckLoading(true);
    const data = await fetch("/api/stock/session?check=preopen").then((r) => r.json()).catch(() => ({ lowMenus: [] }));
    setLowMenus(data.lowMenus ?? []);
    setStockCheckLoading(false);
  }

  function confirmOpenStore() {
    const now = new Date().toISOString();
    const float = parseInt(openingFloat) || 0;
    localStorage.setItem(SHIFT_KEY(), JSON.stringify({ openedAt: now, openingFloat: float }));
    setOpenedAt(now);
    setOpeningFloat(String(float));
    setShiftState("OPEN");
    setLowMenus(null);
    fetch("/api/stock/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open" }),
    });
    fetch("/api/cashier/open", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingFloat: float }),
    });
  }

  async function uploadExpensePhoto(file: File) {
    setExpUploading(true);
    const form = new FormData(); form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json() as { url?: string };
    setExpPhoto(data.url ?? null);
    setExpUploading(false);
  }

  async function saveExpense() {
    if (!expAmount || !expDesc) return;
    setExpSaving(true);
    await fetch("/api/cash-expenses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: expType, amount: parseInt(expAmount), description: expDesc, note: expNote || undefined, photoUrl: expPhoto || undefined }),
    });
    setExpSaving(false);
    setShowExpenseModal(false);
    setExpAmount(""); setExpDesc(""); setExpNote(""); setExpPhoto(null);
    loadSummary();
  }

  function startClose() {
    loadSummary();
    setShiftState("CLOSING");
    setCloseStep(1);
  }

  const countedCash = DENOMINATIONS.reduce((s, d) => s + d * (parseInt(counts[d]) || 0), 0);
  const floatNum = parseInt(openingFloat) || 0;
  const pettyTotal = summary?.pettyTotal ?? 0;
  const expectedCash = floatNum + (summary?.cashTotal ?? 0) - pettyTotal;
  const difference = countedCash - expectedCash;

  async function confirmClose() {
    setSaving(true);
    const res = await fetch("/api/cashier/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingFloat: floatNum, countedCash, note }),
    });
    if (res.ok) {
      localStorage.removeItem(SHIFT_KEY());
      // Sync close to DB + fetch reorder list
      const [, stockData] = await Promise.all([
        fetch("/api/stock/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close" }) }),
        fetch("/api/stock/session?check=preclose").then((r) => r.json()).catch(() => ({ needReorder: [] })),
      ]);
      setReorderItems(stockData.needReorder ?? []);
      await loadSummary();
      setCloseStep(4);
    }
    setSaving(false);
  }

  function resetAfterClose() {
    setShiftState("CLOSED");
    setOpenedAt(null);
    setOpeningFloat("0");
    setCounts(Object.fromEntries(DENOMINATIONS.map((d) => [d, ""])));
    setNote("");
    setCloseStep(1);
    setSummary(null);
    setReorderItems([]);
  }

  // ── CLOSED: Open store screen ──────────────────────────────────────────────
  if (shiftState === "CLOSED") {
    return (
      <div className="max-w-sm mx-auto pt-8 space-y-5">
        <div className="text-center space-y-2">
          <p className="text-5xl">🏪</p>
          <h1 className="text-xl font-bold text-navy">เปิดร้านวันนี้</h1>
          <p className="text-gray-400 text-sm">บันทึกยอดเงินเริ่มต้นในเก๊ะก่อนเริ่มขาย</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-navy block mb-1.5">ยอดเงินเปิดเก๊ะ (฿)</label>
            <NumpadInput
              value={Number(openingFloat) || ""}
              onChange={(v) => setOpeningFloat(String(v))}
              placeholder="0"
              label="ยอดเงินเปิดเก๊ะ (฿)"
              className="w-full border-2 border-sand rounded-2xl px-4 py-3 text-2xl font-bold text-center text-navy focus:outline-none focus:border-orange"
            />
            <p className="text-xs text-gray-400 mt-1 text-center">เงินทอนที่เตรียมไว้ก่อนเปิดร้าน</p>
          </div>

          <button
            onClick={handleOpenClick}
            disabled={stockCheckLoading}
            className="w-full bg-green-500 hover:bg-green-400 text-white font-bold py-4 rounded-2xl text-base transition-colors disabled:opacity-50"
          >
            {stockCheckLoading ? "กำลังตรวจสอบสต็อก..." : "✅ เปิดร้าน"}
          </button>
        </div>

        <div className="text-center">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-navy">← กลับ Dashboard</Link>
        </div>

        {/* Pre-open stock check modal */}
        {lowMenus !== null && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
              <div>
                <h3 className="font-bold text-navy text-lg">🟢 ก่อนเปิดร้าน</h3>
                <p className="text-sm text-gray-400 mt-0.5">ตรวจสอบวัตถุดิบ</p>
              </div>

              {lowMenus.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                  ✅ ทุกเมนูมีวัตถุดิบพร้อม
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-600">⚠️ เมนูที่วัตถุดิบอาจไม่พอ ({lowMenus.length} รายการ)</p>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {lowMenus.map((m) => (
                      <div key={m.id} className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                        <p className="text-sm font-semibold text-navy">{m.nameTh}</p>
                        {m.missing.map((miss, i) => (
                          <p key={i} className="text-xs text-red-500 mt-0.5">· {miss}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">พิจารณาปิดเมนูเหล่านี้ในหน้าจัดการเมนูก่อนเปิดร้าน</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setLowMenus(null)} className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm">ยกเลิก</button>
                <button onClick={confirmOpenStore} className="flex-1 bg-green-600 text-white font-bold py-3 rounded-2xl text-sm">
                  ยืนยันเปิดร้าน
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── OPEN: Running shift ────────────────────────────────────────────────────
  if (shiftState === "OPEN") {
    return (
      <React.Fragment><div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="bg-green-500 rounded-2xl p-5 text-white flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">ร้านเปิดอยู่</p>
            <p className="text-3xl font-bold font-mono mt-1">{timer}</p>
            <p className="text-white/70 text-xs mt-1">
              เปิดตั้งแต่ {openedAt ? formatTime(openedAt) : "--"} น.
              · เงินเปิดเก๊ะ ฿{floatNum.toLocaleString()}
            </p>
          </div>
          <button
            onClick={startClose}
            className="bg-white/20 hover:bg-white/30 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            🔒 ปิดยอด
          </button>
        </div>

        {/* Live summary cards */}
        <SummaryCards onRefresh={loadSummary} loading={loadingSummary} summary={summary} />

        {/* Expense button */}
        <button
          onClick={() => setShowExpenseModal(true)}
          className="w-full flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 font-semibold py-3 rounded-2xl text-sm hover:bg-amber-100 transition-colors"
        >
          🛍️ บันทึกรายจ่ายจากเก๊ะ / พนักงานออกเงินเอง
        </button>

        {/* Today's expenses — always visible */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-amber-100">
          <div className="flex items-center justify-between px-4 py-3 border-b border-sand">
            <p className="text-sm font-bold text-navy">🛍️ รายจ่ายวันนี้</p>
            {(summary?.pettyExpenses?.length ?? 0) > 0 && (
              <span className="text-xs text-gray-400">{summary!.pettyExpenses.length} รายการ</span>
            )}
          </div>
          {(summary?.pettyExpenses?.length ?? 0) === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">ยังไม่มีรายจ่ายวันนี้</p>
          ) : (
            <div className="divide-y divide-sand/50 max-h-52 overflow-y-auto">
              {summary!.pettyExpenses.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setDetailExpense(e)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-sand/30 transition-colors"
                >
                  {e.photoUrl ? (
                    <img src={e.photoUrl} alt="receipt" className="w-9 h-9 rounded-lg object-cover shrink-0 border border-sand" />
                  ) : (
                    <span className="text-base shrink-0 w-9 h-9 flex items-center justify-center bg-sand/40 rounded-lg">{e.type === "PETTY_CASH" ? "🗃️" : "👤"}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy truncate">{e.description}</p>
                    <p className="text-xs text-gray-400">
                      {e.type === "PETTY_CASH" ? "ซื้อของเข้าร้าน" : "พนักงานออกเองก่อน"}
                      {e.type === "STAFF_ADVANCE" && e.reimbursed ? " · คืนแล้ว ✅" : ""}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-red-600 shrink-0">-฿{e.amount.toLocaleString()}</p>
                </button>
              ))}
            </div>
          )}
          {(summary?.pettyTotal ?? 0) > 0 && (
            <div className="px-4 py-2.5 border-t border-sand bg-amber-50 flex justify-between text-sm">
              <span className="text-amber-700 font-semibold">รวมรายจ่ายเก๊ะ</span>
              <span className="font-bold text-red-600">-฿{(summary?.pettyTotal ?? 0).toLocaleString()}</span>
            </div>
          )}
          {(summary?.advanceTotal ?? 0) > 0 && (
            <div className="px-4 py-2 bg-purple-50 flex justify-between text-sm border-t border-purple-100">
              <span className="text-purple-700 font-semibold">ค้างจ่ายคืนพนักงาน</span>
              <span className="font-bold text-purple-700">฿{(summary?.advanceTotal ?? 0).toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="text-center">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-navy">← กลับ Dashboard</Link>
        </div>
      </div>

      {/* Expense modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy text-lg">🛍️ บันทึกรายจ่าย</h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setExpType("PETTY_CASH")}
                className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-colors ${expType === "PETTY_CASH" ? "bg-amber-500 border-amber-500 text-white" : "border-sand text-gray-500"}`}
              >
                🗃️ ซื้อของเข้าร้าน
              </button>
              <button
                onClick={() => setExpType("STAFF_ADVANCE")}
                className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-colors ${expType === "STAFF_ADVANCE" ? "bg-purple-500 border-purple-500 text-white" : "border-sand text-gray-500"}`}
              >
                👤 ออกเงินเองก่อน
              </button>
            </div>
            <p className="text-xs text-gray-400 -mt-2">
              {expType === "PETTY_CASH" ? "เงินจากเก๊ะ — จะหักออกจากยอดเงินคงเหลือ" : "พนักงานออกเงินส่วนตัวก่อน — บันทึกไว้เพื่อคืนเงิน"}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">รายละเอียด *</label>
                <input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="เช่น ซื้อน้ำแข็ง, ซื้อกระดาษทิชชู่..." className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">จำนวนเงิน (฿) *</label>
                <NumpadInput value={Number(expAmount) || ""} onChange={(v) => setExpAmount(String(v))} placeholder="0" label="จำนวนเงิน" className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">หมายเหตุ (ถ้ามี)</label>
                <input value={expNote} onChange={(e) => setExpNote(e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">รูปหลักฐาน (ถ้ามี)</label>
                {expPhoto ? (
                  <div className="relative">
                    <img src={expPhoto} alt="receipt" className="w-full h-32 object-cover rounded-xl" />
                    <button onClick={() => setExpPhoto(null)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center">✕</button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 border-2 border-dashed border-sand rounded-xl px-3 py-3 cursor-pointer hover:border-orange transition-colors">
                    <span className="text-gray-400 text-sm">{expUploading ? "กำลังอัปโหลด..." : "📷 แนบรูปบิล / ของที่ซื้อ"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadExpensePhoto(e.target.files[0]); }} />
                  </label>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowExpenseModal(false)} className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm">ยกเลิก</button>
              <button onClick={saveExpense} disabled={expSaving || !expAmount || !expDesc} className="flex-1 bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50">
                {expSaving ? "กำลังบันทึก..." : "✅ บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Expense detail modal */}
      {detailExpense && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4" onClick={() => setDetailExpense(null)}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{detailExpense.type === "PETTY_CASH" ? "🗃️" : "👤"}</span>
                <h3 className="font-bold text-navy text-base">
                  {detailExpense.type === "PETTY_CASH" ? "ซื้อของเข้าร้าน" : "พนักงานออกเงินเอง"}
                </h3>
              </div>
              <button onClick={() => setDetailExpense(null)} className="text-gray-400 text-xl">✕</button>
            </div>

            {detailExpense.photoUrl && (
              <div className="px-5 pb-3">
                <img
                  src={detailExpense.photoUrl}
                  alt="receipt"
                  className="w-full max-h-64 object-contain rounded-2xl bg-sand/20 border border-sand"
                />
              </div>
            )}

            <div className="px-5 pb-5 space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">รายละเอียด</p>
                <p className="text-sm font-semibold text-navy">{detailExpense.description}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">จำนวนเงิน</p>
                  <p className="text-xl font-bold text-red-600">-฿{detailExpense.amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">เวลา</p>
                  <p className="text-sm font-semibold text-navy">{formatTime(detailExpense.createdAt)} น.</p>
                </div>
              </div>
              {detailExpense.note && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">หมายเหตุ</p>
                  <p className="text-sm text-navy">{detailExpense.note}</p>
                </div>
              )}
              {detailExpense.type === "STAFF_ADVANCE" && (
                <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${detailExpense.reimbursed ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}>
                  <span className="text-sm font-semibold">
                    {detailExpense.reimbursed ? "✅ คืนเงินแล้ว" : "⏳ ยังไม่ได้คืนเงิน"}
                  </span>
                  <button
                    onClick={async () => {
                      await fetch("/api/cash-expenses", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: detailExpense.id }),
                      });
                      setDetailExpense((prev) => prev ? { ...prev, reimbursed: !prev.reimbursed } : null);
                      loadSummary();
                    }}
                    className="text-xs font-semibold text-orange underline"
                  >
                    {detailExpense.reimbursed ? "ยกเลิก" : "กดเมื่อคืนแล้ว"}
                  </button>
                </div>
              )}
              <button onClick={() => setDetailExpense(null)} className="w-full border border-sand text-gray-400 py-2.5 rounded-2xl text-sm mt-1">
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
    );
  }

  // ── CLOSING: EOD wizard ────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as const).map((s) => (
          <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${closeStep >= s ? "bg-orange" : "bg-sand"}`} />
        ))}
      </div>

      {/* Step 1: Daily summary */}
      {closeStep === 1 && summary && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-navy">📋 สรุปยอดประจำวัน</h2>
            <p className="text-sm text-gray-400">{formatThaiDate(summary.date)}</p>
          </div>

          {/* Revenue breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
              <p className="text-xs text-green-600 font-semibold">เงินสด</p>
              <p className="text-2xl font-bold text-green-700">฿{summary.cashTotal.toLocaleString()}</p>
              <p className="text-xs text-green-500">{summary.cashPayments.length} รายการ</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
              <p className="text-xs text-blue-600 font-semibold">โอน / QR</p>
              <p className="text-2xl font-bold text-blue-700">฿{summary.transferTotal.toLocaleString()}</p>
              <p className="text-xs text-blue-500">{summary.transferPayments.length} รายการ</p>
            </div>
            <div className="bg-orange/5 border border-orange/20 rounded-2xl p-4 text-center">
              <p className="text-xs text-orange font-semibold">อาหาร / เครื่องดื่ม</p>
              <p className="text-2xl font-bold text-orange">฿{summary.ordersTotal.toLocaleString()}</p>
              <p className="text-xs text-orange/60">{summary.ordersCount} ออเดอร์</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
              <p className="text-xs text-purple-600 font-semibold">เวลาเล่น</p>
              <p className="text-2xl font-bold text-purple-700">฿{summary.gametimeTotal.toLocaleString()}</p>
              <p className="text-xs text-purple-500">{summary.gametimeCount} sessions</p>
            </div>
          </div>

          <div className="bg-navy rounded-2xl p-4 flex items-center justify-between text-white">
            <span className="font-semibold">รวมทั้งหมด</span>
            <span className="text-2xl font-bold">฿{summary.grandTotal.toLocaleString()}</span>
          </div>

          {/* Transaction list */}
          {summary.cashPayments.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <p className="text-sm font-bold text-navy px-4 py-3 border-b border-sand">รายการเงินสด</p>
              <div className="divide-y divide-sand/50 max-h-56 overflow-y-auto">
                {summary.cashPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-navy">{p.order.orderName}</p>
                      <p className="text-xs text-gray-400">{formatTime(p.confirmedAt)} น.</p>
                    </div>
                    <p className="font-bold text-green-700">฿{p.amountTHB.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {summary.transferPayments.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <p className="text-sm font-bold text-navy px-4 py-3 border-b border-sand">รายการโอน / QR</p>
              <div className="divide-y divide-sand/50 max-h-40 overflow-y-auto">
                {summary.transferPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-navy">{p.order.orderName}</p>
                      <p className="text-xs text-gray-400">{formatTime(p.confirmedAt)} น.</p>
                    </div>
                    <p className="font-bold text-blue-700">฿{p.amountTHB.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setCloseStep(2)}
            className="w-full bg-orange text-white font-bold py-3.5 rounded-2xl text-sm">
            ถัดไป: นับเงิน →
          </button>
          <button onClick={() => setShiftState("OPEN")} className="w-full text-gray-400 text-sm py-2">
            ← ยกเลิก กลับร้าน
          </button>
        </div>
      )}

      {loadingSummary && closeStep === 1 && (
        <div className="text-center py-16 text-gray-400">กำลังโหลดสรุปยอด...</div>
      )}

      {/* Step 2: Cash count */}
      {closeStep === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-navy">💵 นับเงินในเก๊ะ</h2>
            <p className="text-sm text-gray-400">นับธนบัตรและเหรียญทั้งหมดในลิ้นชักตอนนี้</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            {/* Opening float reminder */}
            <div className="bg-sand/40 rounded-xl px-3 py-2 flex justify-between text-sm">
              <span className="text-gray-500">เงินเปิดเก๊ะ</span>
              <span className="font-bold text-navy">฿{floatNum.toLocaleString()}</span>
            </div>

            <div className="border-t border-sand pt-3 space-y-2">
              {DENOMINATIONS.map((d) => {
                const subtotal = d * (parseInt(counts[d]) || 0);
                return (
                  <div key={d} className="flex items-center gap-2">
                    <span className="w-14 text-right text-sm font-semibold text-navy shrink-0">฿{d}</span>
                    <span className="text-gray-400 text-sm shrink-0">×</span>
                    <NumpadInput
                      value={Number(counts[d]) || ""}
                      onChange={(v) => setCounts((prev) => ({ ...prev, [d]: v === 0 ? "" : String(v) }))}
                      placeholder="0"
                      label={`฿${d} × จำนวน`}
                      className="w-20 border border-sand rounded-xl px-2 py-1.5 text-sm text-center focus:outline-none focus:border-orange"
                    />
                    <span className="text-gray-400 text-sm shrink-0">=</span>
                    <span className="flex-1 text-right text-sm font-semibold text-navy">
                      {subtotal > 0 ? `฿${subtotal.toLocaleString()}` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-sand pt-3 flex items-center justify-between">
              <span className="font-bold text-navy">รวมที่นับได้</span>
              <span className="text-2xl font-bold text-orange">฿{countedCash.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setCloseStep(1)} className="flex-1 border border-sand text-gray-400 font-semibold py-3 rounded-2xl text-sm">
              ← ย้อนกลับ
            </button>
            <button onClick={() => setCloseStep(3)} className="flex-1 bg-orange text-white font-bold py-3 rounded-2xl text-sm">
              ถัดไป: เปรียบเทียบ →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Compare & confirm */}
      {closeStep === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-navy">⚖️ เปรียบเทียบยอด</h2>
            <p className="text-sm text-gray-400">ตรวจสอบความถูกต้องก่อนปิดยอด</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">เงินเปิดเก๊ะ</span>
              <span className="font-semibold text-navy">฿{floatNum.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">เงินสดรับวันนี้ (ระบบ)</span>
              <span className="font-semibold text-navy">฿{(summary?.cashTotal ?? 0).toLocaleString()}</span>
            </div>
            {pettyTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">หัก: รายจ่ายจากเก๊ะ</span>
                <span className="font-semibold text-red-600">-฿{pettyTotal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-sand pt-2">
              <span className="font-bold text-navy">ยอดที่ควรมีในลิ้นชัก</span>
              <span className="font-bold text-navy">฿{expectedCash.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">นับได้จริง</span>
              <span className="font-bold text-navy">฿{countedCash.toLocaleString()}</span>
            </div>
            <div className={`flex justify-between items-center rounded-xl px-4 py-3 mt-1 ${
              difference === 0 ? "bg-green-50 border border-green-200" :
              difference > 0 ? "bg-blue-50 border border-blue-200" :
              "bg-red-50 border border-red-200"
            }`}>
              <span className="font-bold text-sm">
                {difference === 0 ? "✅ สมดุล" : difference > 0 ? "📈 เงินเกิน" : "📉 เงินขาด"}
              </span>
              <span className={`text-2xl font-bold ${
                difference === 0 ? "text-green-600" :
                difference > 0 ? "text-blue-600" :
                "text-red-600"
              }`}>
                {difference > 0 ? "+" : ""}{difference.toLocaleString()} ฿
              </span>
            </div>

            {difference !== 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-xs text-yellow-700 font-semibold mb-1">📝 บันทึก Cash Difference</p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full border border-yellow-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange resize-none bg-white"
                  placeholder={difference > 0 ? "เช่น ทอนเงินขาด, ลูกค้าจ่ายเงินเกิน..." : "เช่น ทอนเงินเกิน, สูญหาย..."}
                />
              </div>
            )}

            {/* Transfer summary */}
            <div className="border-t border-sand pt-3 space-y-1">
              <div className="flex justify-between text-gray-500">
                <span>โอน / QR วันนี้</span>
                <span className="font-semibold text-blue-700">฿{(summary?.transferTotal ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-navy">
                <span>ยอดขายรวม</span>
                <span className="text-orange">฿{(summary?.grandTotal ?? 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setCloseStep(2)} className="flex-1 border border-sand text-gray-400 font-semibold py-3 rounded-2xl text-sm">
              ← ย้อนกลับ
            </button>
            <button
              onClick={confirmClose}
              disabled={saving}
              className="flex-1 bg-navy text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "🔒 ยืนยันปิดยอด"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {closeStep === 4 && (
        <div className="text-center py-10 space-y-4">
          <p className="text-6xl">✅</p>
          <h2 className="text-xl font-bold text-navy">ปิดยอดเรียบร้อย!</h2>
          <p className="text-gray-400 text-sm">รายงานถูกบันทึกลงระบบแล้ว</p>

          {summary?.lastClose && (
            <div className="bg-white rounded-2xl shadow-sm p-4 text-left text-sm space-y-2 max-w-xs mx-auto mt-2">
              <div className="flex justify-between"><span className="text-gray-500">ยอดขายรวม</span><span className="font-bold text-orange">฿{summary.grandTotal.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">เงินสด</span><span className="font-semibold">฿{summary.cashTotal.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">โอน/QR</span><span className="font-semibold">฿{summary.transferTotal.toLocaleString()}</span></div>
              <div className={`flex justify-between border-t border-sand pt-2 font-bold ${
                summary.lastClose.difference === 0 ? "text-green-600" :
                summary.lastClose.difference > 0 ? "text-blue-600" : "text-red-600"
              }`}>
                <span>ขาด/เกิน</span>
                <span>{summary.lastClose.difference > 0 ? "+" : ""}{summary.lastClose.difference.toLocaleString()} ฿</span>
              </div>
            </div>
          )}

          {reorderItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2 max-w-xs mx-auto">
              <p className="text-xs font-bold text-amber-800">📋 ต้องสั่งซื้อเพิ่ม ({reorderItems.length} รายการ)</p>
              {reorderItems.map((i) => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span className="text-navy font-medium">{i.name}</span>
                  <span className="text-amber-700 font-bold">{i.currentQty}/{i.reorderQty} {i.unit}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button onClick={resetAfterClose} className="bg-orange text-white font-bold px-6 py-3 rounded-2xl text-sm mx-auto">
              🏪 เปิดร้านรอบใหม่
            </button>
            <Link href="/admin" className="text-sm text-gray-400 hover:text-navy">กลับ Dashboard</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCards({ onRefresh, loading, summary }: {
  onRefresh: () => void;
  loading: boolean;
  summary: Summary | null;
}) {
  useEffect(() => { onRefresh(); }, [onRefresh]);

  if (loading && !summary) {
    return <div className="text-center py-8 text-gray-400 text-sm">กำลังโหลด...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-navy">ยอดขายวันนี้ (Live)</p>
        <button onClick={onRefresh} className="text-xs text-orange hover:underline">↻ รีเฟรช</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-green-600 font-semibold">เงินสด</p>
          <p className="text-2xl font-bold text-green-700">฿{(summary?.cashTotal ?? 0).toLocaleString()}</p>
          <p className="text-xs text-green-500">{summary?.cashPayments.length ?? 0} รายการ</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-blue-600 font-semibold">โอน / QR</p>
          <p className="text-2xl font-bold text-blue-700">฿{(summary?.transferTotal ?? 0).toLocaleString()}</p>
          <p className="text-xs text-blue-500">{summary?.transferPayments.length ?? 0} รายการ</p>
        </div>
        <div className="bg-orange/5 border border-orange/20 rounded-2xl p-4 text-center">
          <p className="text-xs text-orange font-semibold">อาหาร/เครื่องดื่ม</p>
          <p className="text-2xl font-bold text-orange">฿{(summary?.ordersTotal ?? 0).toLocaleString()}</p>
          <p className="text-xs text-orange/60">{summary?.ordersCount ?? 0} ออเดอร์</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-purple-600 font-semibold">เวลาเล่น</p>
          <p className="text-2xl font-bold text-purple-700">฿{(summary?.gametimeTotal ?? 0).toLocaleString()}</p>
          <p className="text-xs text-purple-500">{summary?.gametimeCount ?? 0} sessions</p>
        </div>
      </div>
      <div className="bg-navy rounded-2xl p-4 flex items-center justify-between text-white">
        <span className="font-semibold text-sm">รวมทั้งหมด</span>
        <span className="text-2xl font-bold">฿{(summary?.grandTotal ?? 0).toLocaleString()}</span>
      </div>
    </div>
  );
}
