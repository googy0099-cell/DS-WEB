"use client";

import { useState, useEffect } from "react";

type CashExpense = {
  id: number;
  type: string;
  amount: number;
  description: string;
  photoUrl: string | null;
  note: string | null;
  reimbursed: boolean;
  createdAt: string;
};

function todayBKK() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
function startOfMonthBKK() {
  return todayBKK().slice(0, 7) + "-01";
}
function fmtDateTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default function ExpensesPage() {
  const [from, setFrom] = useState(startOfMonthBKK());
  const [to, setTo] = useState(todayBKK());
  const [expenses, setExpenses] = useState<CashExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const data = await fetch(`/api/cash-expenses?from=${from}&to=${to}`).then((r) => r.json()) as CashExpense[];
    setExpenses(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [from, to]);

  async function toggleReimbursed(e: CashExpense) {
    setToggling(e.id);
    const updated = await fetch("/api/cash-expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: e.id, reimbursed: !e.reimbursed }),
    }).then((r) => r.json()) as CashExpense;
    setExpenses((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setToggling(null);
  }

  const pettyList = expenses.filter((e) => e.type === "PETTY_CASH");
  const advanceList = expenses.filter((e) => e.type === "STAFF_ADVANCE");
  const pettyTotal = pettyList.reduce((s, e) => s + e.amount, 0);
  const advanceTotal = advanceList.reduce((s, e) => s + e.amount, 0);
  const pendingReimburse = advanceList.filter((e) => !e.reimbursed).reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-navy">รายจ่ายจากเก๊ะ</h1>
        <p className="text-gray-400 text-sm">ซื้อของเข้าร้าน และพนักงานออกเงินก่อน</p>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <label className="text-xs text-gray-500 shrink-0">ตั้งแต่</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="border border-sand rounded-xl px-3 py-1.5 text-sm focus:border-orange focus:outline-none" />
        <label className="text-xs text-gray-500 shrink-0">ถึง</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="border border-sand rounded-xl px-3 py-1.5 text-sm focus:border-orange focus:outline-none" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
          <p className="text-xs text-amber-600 font-semibold">ซื้อของเข้าร้าน</p>
          <p className="text-xl font-bold text-amber-700">฿{pettyTotal.toLocaleString()}</p>
          <p className="text-xs text-amber-500">{pettyList.length} รายการ</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 text-center">
          <p className="text-xs text-purple-600 font-semibold">พนักงานออกก่อน</p>
          <p className="text-xl font-bold text-purple-700">฿{advanceTotal.toLocaleString()}</p>
          <p className="text-xs text-purple-500">{advanceList.length} รายการ</p>
        </div>
        <div className={`rounded-2xl p-3 text-center border ${pendingReimburse > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
          <p className={`text-xs font-semibold ${pendingReimburse > 0 ? "text-red-600" : "text-green-600"}`}>ค้างคืน</p>
          <p className={`text-xl font-bold ${pendingReimburse > 0 ? "text-red-700" : "text-green-700"}`}>฿{pendingReimburse.toLocaleString()}</p>
          <p className={`text-xs ${pendingReimburse > 0 ? "text-red-500" : "text-green-500"}`}>{pendingReimburse > 0 ? "ยังไม่คืน" : "คืนครบแล้ว ✅"}</p>
        </div>
      </div>

      {loading && <div className="text-center py-10 text-gray-400 text-sm">กำลังโหลด...</div>}

      {!loading && expenses.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">ไม่มีรายจ่ายในช่วงนี้</div>
      )}

      {!loading && expenses.length > 0 && (
        <div className="space-y-3">
          {expenses.map((e) => (
            <div key={e.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${e.type === "STAFF_ADVANCE" ? "border-purple-100" : "border-amber-100"}`}>
              <div className="flex items-start gap-3 p-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${e.type === "PETTY_CASH" ? "bg-amber-100" : "bg-purple-100"}`}>
                  {e.type === "PETTY_CASH" ? "🗃️" : "👤"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-navy text-sm">{e.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {e.type === "PETTY_CASH" ? "ซื้อของเข้าร้าน" : "พนักงานออกเงินก่อน"}
                        {" · "}{fmtDateTime(e.createdAt)} น.
                      </p>
                      {e.note && <p className="text-xs text-gray-500 mt-0.5 italic">{e.note}</p>}
                    </div>
                    <p className="text-base font-bold text-red-600 shrink-0">-฿{e.amount.toLocaleString()}</p>
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {/* Photo */}
                    {e.photoUrl && (
                      <button
                        onClick={() => setPhotoModal(e.photoUrl!)}
                        className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 hover:bg-blue-100 transition-colors"
                      >
                        📷 ดูรูป
                      </button>
                    )}
                    {/* Reimburse toggle (STAFF_ADVANCE only) */}
                    {e.type === "STAFF_ADVANCE" && (
                      <button
                        onClick={() => toggleReimbursed(e)}
                        disabled={toggling === e.id}
                        className={`flex items-center gap-1 text-xs rounded-lg px-2 py-1 border transition-colors disabled:opacity-50 ${
                          e.reimbursed
                            ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50"
                        }`}
                      >
                        {toggling === e.id ? "..." : e.reimbursed ? "✅ คืนแล้ว" : "⬜ ยังไม่คืน"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo modal */}
      {photoModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPhotoModal(null)}>
          <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <img src={photoModal} alt="receipt" className="w-full rounded-2xl object-contain max-h-[75vh]" />
            <button onClick={() => setPhotoModal(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
