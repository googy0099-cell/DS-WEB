"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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

  const [closeStep, setCloseStep] = useState<CloseStep>(1);
  const [counts, setCounts] = useState<Record<number, string>>(
    Object.fromEntries(DENOMINATIONS.map((d) => [d, ""]))
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Restore today's shift from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SHIFT_KEY());
    if (stored) {
      const { openedAt: oa, openingFloat: of_ } = JSON.parse(stored);
      setOpenedAt(oa);
      setOpeningFloat(String(of_));
      setShiftState("OPEN");
    }
  }, []);

  // Live timer
  useEffect(() => {
    if (shiftState !== "OPEN" || !openedAt) return;
    const tick = () => setTimer(elapsed(openedAt));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [shiftState, openedAt]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    const data = await fetch("/api/cashier/summary").then((r) => r.json());
    setSummary(data);
    setLoadingSummary(false);
  }, []);

  function openStore() {
    const now = new Date().toISOString();
    const float = parseInt(openingFloat) || 0;
    localStorage.setItem(SHIFT_KEY(), JSON.stringify({ openedAt: now, openingFloat: float }));
    setOpenedAt(now);
    setOpeningFloat(String(float));
    setShiftState("OPEN");
  }

  function startClose() {
    loadSummary();
    setShiftState("CLOSING");
    setCloseStep(1);
  }

  const countedCash = DENOMINATIONS.reduce((s, d) => s + d * (parseInt(counts[d]) || 0), 0);
  const floatNum = parseInt(openingFloat) || 0;
  const expectedCash = floatNum + (summary?.cashTotal ?? 0);
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
            <input
              type="number"
              inputMode="numeric"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              className="w-full border-2 border-sand rounded-2xl px-4 py-3 text-2xl font-bold text-center text-navy focus:outline-none focus:border-orange"
            />
            <p className="text-xs text-gray-400 mt-1 text-center">เงินทอนที่เตรียมไว้ก่อนเปิดร้าน</p>
          </div>

          <button
            onClick={openStore}
            className="w-full bg-green-500 hover:bg-green-400 text-white font-bold py-4 rounded-2xl text-base transition-colors"
          >
            ✅ เปิดร้าน
          </button>
        </div>

        <div className="text-center">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-navy">← กลับ Dashboard</Link>
        </div>
      </div>
    );
  }

  // ── OPEN: Running shift ────────────────────────────────────────────────────
  if (shiftState === "OPEN") {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
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

        <div className="text-center">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-navy">← กลับ Dashboard</Link>
        </div>
      </div>
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
                    <input
                      type="number"
                      inputMode="numeric"
                      value={counts[d]}
                      onChange={(e) => setCounts((prev) => ({ ...prev, [d]: e.target.value }))}
                      placeholder="0"
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
