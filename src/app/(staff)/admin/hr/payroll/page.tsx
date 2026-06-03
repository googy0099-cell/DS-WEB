"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Deduction = { id: number; amount: number; reason: string; note: string | null; createdAt: string };
type StaffPayroll = {
  id: number; name: string; baseSalary: number;
  summary: { daysWorked: number; onTimeCount: number; lateCount: number; earlyLeaveCount: number; workMinutes: number };
  deductions: Deduction[]; totalDeductions: number; netPay: number;
};
type PayrollData = { year: number; month: number; staff: StaffPayroll[] };

const MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function thb(n: number) { return n.toLocaleString("th-TH"); }
function hoursLabel(min: number) {
  return `${Math.floor(min / 60)}ชม. ${min % 60}น.`;
}

export default function AdminHrPayrollPage() {
  const today = new Date();
  const bkk = new Date(today.getTime() + 7 * 60 * 60 * 1000);
  const [year, setYear] = useState(bkk.getUTCFullYear());
  const [month, setMonth] = useState(bkk.getUTCMonth() + 1);
  const [data, setData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [salaryEdit, setSalaryEdit] = useState<{ staffId: number; value: string } | null>(null);
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

  async function saveSalary() {
    if (!salaryEdit) return;
    const n = Number(salaryEdit.value);
    if (Number.isNaN(n) || n < 0) { alert("กรอกตัวเลขให้ถูกต้อง"); return; }
    const res = await fetch(`/api/hr/staff/${salaryEdit.staffId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseSalary: n }),
    });
    if (!res.ok) { alert("บันทึกไม่สำเร็จ"); return; }
    setSalaryEdit(null); fetchData();
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

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-orange text-xs">← Admin</Link>
          <h1 className="text-xl font-bold text-navy">เงินเดือนพนักงาน</h1>
        </div>
      </div>

      {/* Month picker */}
      <div className="flex gap-2 mb-4">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm">
          {MONTH_LABELS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="border border-sand rounded-xl px-3 py-2 text-sm">
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y + 543}</option>)}
        </select>
      </div>

      {loading && <p className="text-center text-gray-400 text-sm">กำลังโหลด...</p>}
      {error && <p className="text-center text-red-500 text-sm">{error}</p>}

      {!loading && !error && data && (
        <>
          {/* Grand total */}
          <div className="bg-orange/10 border border-orange/30 rounded-2xl p-4 mb-4 flex items-center justify-between">
            <span className="font-bold text-sm text-navy">รวมจ่ายเดือนนี้</span>
            <span className="font-bold text-2xl text-orange">฿{thb(data.staff.reduce((s, x) => s + x.netPay, 0))}</span>
          </div>

          <div className="space-y-4">
            {data.staff.map((s) => (
              <div key={s.id} className="bg-white border border-sand/50 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-navy">{s.name}</h2>
                  <span className={`font-bold text-lg ${s.netPay < 0 ? "text-red-500" : "text-emerald-600"}`}>
                    ฿{thb(s.netPay)}
                  </span>
                </div>

                {/* Salary + deductions */}
                <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                  <div className="bg-gray-50 rounded-xl px-3 py-2">
                    <p className="text-gray-400 text-xs">เงินเดือน</p>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-navy">฿{thb(s.baseSalary)}</span>
                      <button onClick={() => setSalaryEdit({ staffId: s.id, value: String(s.baseSalary) })} className="text-xs text-orange font-medium">แก้</button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-3 py-2">
                    <p className="text-gray-400 text-xs">หักรวม</p>
                    <p className="font-bold text-red-500">−฿{thb(s.totalDeductions)}</p>
                  </div>
                </div>

                {/* Attendance */}
                <div className="grid grid-cols-4 gap-1.5 mb-3 text-center text-xs">
                  <div className="bg-gray-50 rounded-lg py-2">
                    <p className="text-gray-400">ทำงาน</p>
                    <p className="font-bold text-navy">{s.summary.daysWorked}วัน</p>
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
                <p className="text-xs text-gray-400 mb-3">ทำงานรวม {hoursLabel(s.summary.workMinutes)}</p>

                {/* Deductions */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-navy">รายการหักเงิน</p>
                  <button onClick={() => setDedForm({ staffId: s.id, name: s.name, amount: "", reason: "", note: "" })}
                    className="text-xs px-3 py-1 bg-orange text-white rounded-lg font-bold">
                    + หักเงิน
                  </button>
                </div>

                {s.deductions.length === 0 ? (
                  <p className="text-gray-400 text-xs">ไม่มี</p>
                ) : (
                  <div className="space-y-1.5">
                    {s.deductions.map((d) => (
                      <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-navy">{d.reason}</p>
                          {d.note && <p className="text-xs text-gray-400 truncate">{d.note}</p>}
                        </div>
                        <span className="text-red-500 font-bold mx-3">−฿{thb(d.amount)}</span>
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

      {/* Salary edit modal */}
      {salaryEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-lg text-navy mb-4">ตั้งเงินเดือน</h3>
            <input type="number" min={0} value={salaryEdit.value}
              onChange={(e) => setSalaryEdit({ ...salaryEdit, value: e.target.value })}
              className="w-full mb-4 border border-sand rounded-xl px-3 py-2 text-sm" placeholder="0"
            />
            <div className="flex gap-2">
              <button onClick={() => setSalaryEdit(null)} className="flex-1 py-2 bg-gray-100 rounded-xl text-sm font-bold">ยกเลิก</button>
              <button onClick={saveSalary} className="flex-1 py-2 bg-orange text-white rounded-xl text-sm font-bold">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Deduction modal */}
      {dedForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-lg text-navy mb-1">หักเงิน — {dedForm.name}</h3>
            <p className="text-xs text-gray-400 mb-4">สำหรับเดือน {MONTH_LABELS[month - 1]} {year + 543}</p>

            <label className="block text-sm text-gray-600 mb-1">จำนวนเงิน (฿)</label>
            <input type="number" min={1} value={dedForm.amount}
              onChange={(e) => setDedForm({ ...dedForm, amount: e.target.value })}
              className="w-full mb-3 border border-sand rounded-xl px-3 py-2 text-sm" placeholder="100"
            />
            <label className="block text-sm text-gray-600 mb-1">เหตุผล</label>
            <input type="text" value={dedForm.reason}
              onChange={(e) => setDedForm({ ...dedForm, reason: e.target.value })}
              className="w-full mb-3 border border-sand rounded-xl px-3 py-2 text-sm" placeholder="เช่น มาสาย, ลางาน"
            />
            <label className="block text-sm text-gray-600 mb-1">หมายเหตุ (ถ้ามี)</label>
            <textarea value={dedForm.note}
              onChange={(e) => setDedForm({ ...dedForm, note: e.target.value })}
              className="w-full mb-4 border border-sand rounded-xl px-3 py-2 text-sm resize-none" rows={2}
              placeholder="รายละเอียดเพิ่มเติม"
            />
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
