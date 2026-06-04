"use client";

import { useState } from "react";
import useSWR from "swr";

type StaffOption = { id: number; name: string };
type KpiItem = {
  id: number;
  staffId: number;
  title: string;
  target: number;
  actual: number;
  unit: string;
  month: number;
  year: number;
  staff: { user: { firstName: string; lastName: string } };
};

const MONTH_NAMES = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function AdminKpiPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ staffId: "", title: "", target: "", unit: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editActual, setEditActual] = useState("");

  const { data: kpis = [], mutate } = useSWR<KpiItem[]>(`/api/hr/kpi?month=${month}&year=${year}`, fetcher);
  const { data: staff = [] } = useSWR<StaffOption[]>("/api/hr/staff", fetcher);

  const grouped = kpis.reduce<Record<string, KpiItem[]>>((acc, k) => {
    const name = `${k.staff.user.firstName} ${k.staff.user.lastName}`.trim();
    (acc[name] ??= []).push(k);
    return acc;
  }, {});

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); } else setMonth((m) => m + 1);
  }

  async function createKpi() {
    if (!form.title || !form.target || !form.unit || !form.staffId) return;
    setSaving(true);
    await fetch("/api/hr/kpi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: Number(form.staffId), title: form.title, target: Number(form.target), unit: form.unit, month, year }),
    });
    await mutate();
    setForm({ staffId: "", title: "", target: "", unit: "" });
    setModal(false);
    setSaving(false);
  }

  async function saveActual(id: number) {
    await fetch(`/api/hr/kpi/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual: Number(editActual) }),
    });
    await mutate();
    setEditId(null);
  }

  async function deleteKpi(id: number) {
    if (!confirm("ลบ KPI นี้?")) return;
    await fetch(`/api/hr/kpi/${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">🎯 ตั้ง KPI</h1>
          <p className="text-xs text-gray-400 mt-0.5">ตั้งเป้าหมายและติดตามผลรายบุคคล</p>
        </div>
        <button onClick={() => setModal(true)} className="bg-orange text-white font-bold px-4 py-2 rounded-xl text-sm">
          + ตั้ง KPI
        </button>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2">
        <button onClick={prevMonth} className="w-9 h-9 rounded-xl bg-white border border-sand flex items-center justify-center text-navy font-bold">‹</button>
        <span className="flex-1 text-center font-semibold text-sm text-navy">{MONTH_NAMES[month]} {year + 543}</span>
        <button onClick={nextMonth} className="w-9 h-9 rounded-xl bg-white border border-sand flex items-center justify-center text-navy font-bold">›</button>
      </div>

      {/* KPI list grouped by staff */}
      {Object.keys(grouped).length === 0 ? (
        <p className="text-center text-gray-400 py-12 text-sm">ยังไม่มี KPI เดือนนี้</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([name, items]) => (
            <div key={name}>
              <p className="text-xs font-bold text-orange uppercase tracking-wider mb-2">{name}</p>
              <div className="flex flex-col gap-3">
                {items.map((kpi) => {
                  const pct = Math.min(100, kpi.target > 0 ? (kpi.actual / kpi.target) * 100 : 0);
                  const done = pct >= 100;
                  return (
                    <div key={kpi.id} className="bg-white rounded-2xl shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <p className="font-semibold text-sm text-navy">{kpi.title}</p>
                        <button onClick={() => deleteKpi(kpi.id)} className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
                      </div>
                      <div className="w-full h-2 bg-sand/50 rounded-full mb-2">
                        <div
                          className={`h-2 rounded-full transition-all ${done ? "bg-emerald-400" : "bg-orange"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${done ? "text-emerald-600" : "text-orange"}`}>
                          {kpi.actual} / {kpi.target} {kpi.unit}
                        </span>
                        {editId === kpi.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={editActual}
                              onChange={(e) => setEditActual(e.target.value)}
                              className="w-20 border border-sand rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-orange"
                              autoFocus
                            />
                            <button onClick={() => saveActual(kpi.id)} className="text-xs text-emerald-600 font-bold">บันทึก</button>
                            <button onClick={() => setEditId(null)} className="text-xs text-gray-400">ยกเลิก</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditId(kpi.id); setEditActual(String(kpi.actual)); }}
                            className="text-xs text-gray-400 hover:text-navy border border-sand px-2.5 py-1 rounded-lg"
                          >
                            แก้ไขผล
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-navy text-lg">ตั้ง KPI ใหม่</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-navy block mb-1">พนักงาน *</label>
                <select
                  value={form.staffId}
                  onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
                  className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
                >
                  <option value="">เลือกพนักงาน</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="ชื่อ KPI เช่น ยอดขาย, ลูกค้าใหม่ *"
                className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={form.target}
                  onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                  placeholder="เป้าหมาย *"
                  className="flex-1 border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
                />
                <input
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="หน่วย *"
                  className="flex-1 border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setModal(false)} className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm">ยกเลิก</button>
              <button
                onClick={createKpi}
                disabled={saving || !form.title || !form.target || !form.unit || !form.staffId}
                className="flex-1 bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40"
              >
                {saving ? "..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
