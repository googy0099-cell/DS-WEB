"use client";

import { useState, useEffect } from "react";

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
        {summary && <span className="text-sm text-gray-400">{formatThaiDate(summary.date)}</span>}
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
    </div>
  );
}
