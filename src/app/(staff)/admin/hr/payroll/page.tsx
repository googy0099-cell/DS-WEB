"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Deduction = { id: number; amount: number; reason: string; note: string | null; createdAt: string };
type StaffPayroll = {
  id: number; name: string;
  payType: string; payRate: number; gross: number;
  summary: { daysWorked: number; onTimeCount: number; lateCount: number; earlyLeaveCount: number; workMinutes: number };
  deductions: Deduction[]; totalDeductions: number; netPay: number;
};
type PayrollData = { year: number; month: number; staff: StaffPayroll[] };

const MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const PAY_TYPE_LABEL: Record<string, string> = { MONTHLY: "รายเดือน", DAILY: "รายวัน", HOURLY: "รายชั่วโมง" };
const PAY_TYPE_UNIT: Record<string, string> = { MONTHLY: "/เดือน", DAILY: "/วัน", HOURLY: "/ชม." };
const PAY_TYPE_COLOR: Record<string, string> = {
  MONTHLY: "bg-blue-50 text-blue-700",
  DAILY: "bg-purple-50 text-purple-700",
  HOURLY: "bg-teal-50 text-teal-700",
};

function thb(n: number) { return n.toLocaleString("th-TH"); }
function hoursLabel(min: number) { return `${Math.floor(min / 60)}ชม. ${min % 60}น.`; }

function GrossBreakdown({ s }: { s: StaffPayroll }) {
  if (s.payType === "DAILY") return (
    <p className="text-xs text-gray-400">฿{thb(s.payRate)}/วัน × {s.summary.daysWorked} วัน = ฿{thb(s.gross)}</p>
  );
  if (s.payType === "HOURLY") {
    const hrs = (s.summary.workMinutes / 60).toFixed(1);
    return <p className="text-xs text-gray-400">฿{thb(s.payRate)}/ชม. × {hrs} ชม. = ฿{thb(s.gross)}</p>;
  }
  return null;
}

export default function AdminHrPayrollPage() {
  const bkk = new Date(Date.now() + 7 * 3600_000);
  const [year, setYear] = useState(bkk.getUTCFullYear());
  const [month, setMonth] = useState(bkk.getUTCMonth() + 1);
  const [data, setData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const [rateEdit, setRateEdit] = useState<{ staffId: number; payType: string; payRate: string } | null>(null);
  const [dedForm, setDedForm] = useState<{ staffId: number; name: string; amount: string; reason: string; note: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/payroll?year=${year}&month=${month}`);
      if (res.status === 401) { setError("ต้องเป็นเจ้าของร้านเท่านั้น"); return; }
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? `เกิดข้อผิดพลาด (${res.status})`); return; }
      setData(json); setError("");
    } catch { setError("โหลดข้อมูลไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveRate() {
    if (!rateEdit) return;
    const n = Number(rateEdit.payRate);
    if (Number.isNaN(n) || n < 0) { alert("กรอกตัวเลขให้ถูกต้อง"); return; }
    const res = await fetch(`/api/hr/staff/${rateEdit.staffId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseSalary: n, payType: rateEdit.payType }),
    });
    if (!res.ok) { alert("บันทึกไม่สำเร็จ"); return; }
    setRateEdit(null); fetchData();
  }

  async function saveDeduction() {
    if (!dedForm) return;
    const amount = Number(dedForm.amount);
    if (Number.isNaN(amount) || amount <= 0) { alert("กรอกจำนวนเงินให้ถูกต้อง"); return; }
    if (!dedForm.reason.trim()) { alert("กรอกเหตุผล"); return; }
    const res = await fetch("/api/hr/deductions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: dedForm.staffId, amount, reason: dedForm.reason.trim(), note: dedForm.note.trim() || undefined, month, year }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error ?? "บันทึกไม่สำเร็จ"); return; }
    setDedForm(null); fetchData();
  }

  async function deleteDeduction(id: number) {
    if (!confirm("ลบรายการหักเงินนี้?")) return;
    await fetch("/api/hr/deductions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchData();
  }

  function downloadCSV() {
    window.location.href = `/api/hr/payroll/export?year=${year}&month=${month}`;
  }

  async function syncSheets() {
    setSyncing(true); setSyncMsg("");
    try {
      const res = await fetch("/api/hr/sync-sheets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const d = await res.json();
      if (!res.ok) { setSyncMsg(`ไม่สำเร็จ: ${d.error}`); return; }
      setSyncMsg(`ซิงค์แล้ว ${d.synced ?? 0} รายการ`);
    } catch { setSyncMsg("เกิดข้อผิดพลาด"); }
    finally { setSyncing(false); }
  }

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin" className="text-orange text-xs">← Admin</Link>
        <h1 className="text-xl font-bold text-navy">เงินเดือนพนักงาน</h1>
      </div>

      <div className="flex gap-2 mb-3">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm">
          {MONTH_LABELS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-sand rounded-xl px-3 py-2 text-sm">
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y + 543}</option>)}
        </select>
      </div>
      <div className="flex gap-2 mb-2">
        <button onClick={downloadCSV} className="flex-1 py-2 bg-navy text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
          ↓ CSV รวม
        </button>
        <button
          onClick={() => window.open(`/api/hr/payroll/slip?year=${year}&month=${month}`, "_blank")}
          className="flex-1 py-2 bg-orange text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
        >
          📄 สลิปทุกคน
        </button>
        <button onClick={syncSheets} disabled={syncing} className="flex-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl disabled:opacity-60">
          {syncing ? "ซิงค์..." : "↑ Sheets"}
        </button>
      </div>
      {syncMsg && <p className={`text-xs mb-3 px-3 py-2 rounded-xl ${syncMsg.startsWith("ไม่") || syncMsg.startsWith("เกิด") ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>{syncMsg}</p>}

      {loading && <p className="text-center text-gray-400 text-sm py-8">กำลังโหลด...</p>}
      {error && <p className="text-center text-red-500 text-sm">{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="bg-orange/10 border border-orange/30 rounded-2xl p-4 mb-4 flex items-center justify-between">
            <span className="font-bold text-sm text-navy">รวมจ่ายเดือนนี้</span>
            <span className="font-bold text-2xl text-orange">฿{thb(data.staff.reduce((s, x) => s + x.netPay, 0))}</span>
          </div>

          <div className="space-y-4">
            {data.staff.map((s) => (
              <div key={s.id} className="bg-white border border-sand/50 rounded-2xl p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="font-bold text-navy truncate">{s.name}</h2>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${PAY_TYPE_COLOR[s.payType] ?? "bg-gray-100 text-gray-600"}`}>
                      {PAY_TYPE_LABEL[s.payType] ?? s.payType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                      onClick={() => window.open(`/api/hr/payroll/slip?staffId=${s.id}&year=${year}&month=${month}`, "_blank")}
                      className="text-xs px-2 py-1 bg-orange/10 text-orange border border-orange/30 rounded-lg font-semibold hover:bg-orange/20 transition-colors"
                      title="เปิดสลิปเงินเดือน"
                    >
                      📄 สลิป
                    </button>
                    <span className={`font-bold text-lg ${s.netPay < 0 ? "text-red-500" : "text-emerald-600"}`}>
                      ฿{thb(s.netPay)}
                    </span>
                  </div>
                </div>

                {/* Gross breakdown */}
                <div className="flex items-center justify-between mb-3">
                  <GrossBreakdown s={s} />
                  <button
                    onClick={() => setRateEdit({ staffId: s.id, payType: s.payType, payRate: String(s.payRate) })}
                    className="text-xs text-orange font-medium shrink-0 ml-auto"
                  >
                    ตั้งค่าตอบแทน
                  </button>
                </div>

                {/* Gross - deductions = net */}
                <div className="flex items-center gap-2 text-sm mb-3 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-gray-500">ค่าตอบแทน</span>
                  <span className="font-bold text-navy">฿{thb(s.gross)}</span>
                  <span className="text-gray-400 mx-1">−</span>
                  <span className="text-gray-500">หัก</span>
                  <span className="font-bold text-red-500">฿{thb(s.totalDeductions)}</span>
                  <span className="text-gray-400 mx-1">=</span>
                  <span className={`font-bold ml-auto ${s.netPay < 0 ? "text-red-500" : "text-emerald-600"}`}>฿{thb(s.netPay)}</span>
                </div>

                {/* Attendance */}
                <div className="grid grid-cols-4 gap-1.5 mb-3 text-center text-xs">
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="text-gray-400">ทำงาน</p>
                    <p className="font-bold text-navy">{s.summary.daysWorked}วัน</p>
                    <p className="text-gray-400 text-[10px]">{hoursLabel(s.summary.workMinutes)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg py-2">
                    <p className="text-gray-400">ตรงเวลา</p>
                    <p className="font-bold text-emerald-600">{s.summary.onTimeCount}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg py-2">
                    <p className="text-gray-400">สาย</p>
                    <p className="font-bold text-yellow-600">{s.summary.lateCount}</p>
                  </div>
                  <div className="bg-orange/10 rounded-lg py-2">
                    <p className="text-gray-400">ออกก่อน</p>
                    <p className="font-bold text-orange">{s.summary.earlyLeaveCount}</p>
                  </div>
                </div>

                {/* Deductions */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-navy">รายการหักเงิน</p>
                  <button onClick={() => setDedForm({ staffId: s.id, name: s.name, amount: "", reason: "", note: "" })}
                    className="text-xs px-3 py-1 bg-orange text-white rounded-lg font-bold">+ หักเงิน</button>
                </div>
                {s.deductions.length === 0 ? (
                  <p className="text-gray-400 text-xs">ไม่มี</p>
                ) : (
                  <div className="space-y-1.5">
                    {s.deductions.map((d) => (
                      <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-navy">{d.reason}</p>
                          {d.note && <p className="text-xs text-gray-400 truncate">{d.note}</p>}
                        </div>
                        <span className="text-red-500 font-bold mx-3 shrink-0">−฿{thb(d.amount)}</span>
                        <button onClick={() => deleteDeduction(d.id)} className="text-xs text-red-400 font-medium">ลบ</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Rate edit modal */}
      {rateEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-lg text-navy mb-4">ตั้งค่าตอบแทน</h3>

            <label className="block text-sm text-gray-600 mb-1">รูปแบบการจ่าย</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(["MONTHLY", "DAILY", "HOURLY"] as const).map((t) => (
                <button key={t} onClick={() => setRateEdit({ ...rateEdit, payType: t })}
                  className={`py-2 rounded-xl text-sm font-bold border transition-colors ${rateEdit.payType === t ? "bg-orange text-white border-orange" : "bg-white text-gray-600 border-sand"}`}>
                  {PAY_TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            <label className="block text-sm text-gray-600 mb-1">
              อัตรา ({PAY_TYPE_UNIT[rateEdit.payType]})
            </label>
            <input type="number" min={0} value={rateEdit.payRate}
              onChange={(e) => setRateEdit({ ...rateEdit, payRate: e.target.value })}
              className="w-full mb-4 border border-sand rounded-xl px-3 py-2 text-sm" placeholder="0"
            />

            <p className="text-xs text-gray-400 mb-4">
              {rateEdit.payType === "DAILY" && "คำนวณจากจำนวนวันที่เช็คอิน × อัตรานี้"}
              {rateEdit.payType === "HOURLY" && "คำนวณจากชั่วโมงทำงานจริง × อัตรานี้"}
              {rateEdit.payType === "MONTHLY" && "จ่ายอัตรานี้คงที่ทุกเดือน"}
            </p>

            <div className="flex gap-2">
              <button onClick={() => setRateEdit(null)} className="flex-1 py-2 bg-gray-100 rounded-xl text-sm font-bold">ยกเลิก</button>
              <button onClick={saveRate} className="flex-1 py-2 bg-orange text-white rounded-xl text-sm font-bold">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Deduction modal */}
      {dedForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-lg text-navy mb-1">หักเงิน — {dedForm.name}</h3>
            <p className="text-xs text-gray-400 mb-4">เดือน {MONTH_LABELS[month - 1]} {year + 543}</p>
            <label className="block text-sm text-gray-600 mb-1">จำนวนเงิน (฿)</label>
            <input type="number" min={1} value={dedForm.amount}
              onChange={(e) => setDedForm({ ...dedForm, amount: e.target.value })}
              className="w-full mb-3 border border-sand rounded-xl px-3 py-2 text-sm" placeholder="100" />
            <label className="block text-sm text-gray-600 mb-1">เหตุผล</label>
            <input type="text" value={dedForm.reason}
              onChange={(e) => setDedForm({ ...dedForm, reason: e.target.value })}
              className="w-full mb-3 border border-sand rounded-xl px-3 py-2 text-sm" placeholder="เช่น มาสาย, ลางาน" />
            <label className="block text-sm text-gray-600 mb-1">หมายเหตุ (ถ้ามี)</label>
            <textarea value={dedForm.note} onChange={(e) => setDedForm({ ...dedForm, note: e.target.value })}
              className="w-full mb-4 border border-sand rounded-xl px-3 py-2 text-sm resize-none" rows={2} placeholder="รายละเอียดเพิ่มเติม" />
            <div className="flex gap-2">
              <button onClick={() => setDedForm(null)} className="flex-1 py-2 bg-gray-100 rounded-xl text-sm font-bold">ยกเลิก</button>
              <button onClick={saveDeduction} className="flex-1 py-2 bg-orange text-white rounded-xl text-sm font-bold">บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
