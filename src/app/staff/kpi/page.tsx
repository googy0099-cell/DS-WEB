"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import StaffNav from "@/components/hr/StaffNav";

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

export default function KpiPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string })?.role;
  const canManage = ["MANAGER", "OWNER"].includes(role ?? "");

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [kpis, setKpis] = useState<KpiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [staff, setStaff] = useState<{ id: number; name: string }[]>([]);
  const [form, setForm] = useState({ staffId: "", title: "", target: "", unit: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editActual, setEditActual] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/api/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    fetch(`/api/hr/kpi?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then(setKpis)
      .finally(() => setLoading(false));
  }, [status, month, year]);

  useEffect(() => {
    if (!canManage) return;
    fetch("/api/hr/staff").then((r) => r.json()).then((data) => setStaff(data.map((s: { id: number; name: string }) => ({ id: s.id, name: s.name }))));
  }, [canManage]);

  async function createKpi() {
    if (!form.title || !form.target || !form.unit || !form.staffId) return;
    setSaving(true);
    const kpi = await fetch("/api/hr/kpi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: Number(form.staffId), title: form.title, target: Number(form.target), unit: form.unit, month, year }),
    }).then((r) => r.json());
    setKpis((prev) => [...prev, kpi]);
    setForm({ staffId: "", title: "", target: "", unit: "" });
    setShowForm(false);
    setSaving(false);
  }

  async function saveActual(id: number) {
    const kpi = await fetch(`/api/hr/kpi/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual: Number(editActual) }),
    }).then((r) => r.json());
    setKpis((prev) => prev.map((k) => (k.id === kpi.id ? { ...k, actual: kpi.actual } : k)));
    setEditId(null);
  }

  async function deleteKpi(id: number) {
    await fetch(`/api/hr/kpi/${id}`, { method: "DELETE" });
    setKpis((prev) => prev.filter((k) => k.id !== id));
  }

  const grouped = kpis.reduce<Record<string, KpiItem[]>>((acc, k) => {
    const name = `${k.staff.user.firstName} ${k.staff.user.lastName}`.trim();
    (acc[name] ??= []).push(k);
    return acc;
  }, {});

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center text-[#f8f1e5]/40 text-sm">กำลังโหลด...</div>;

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold">KPI</h1>
        {canManage && (
          <button onClick={() => setShowForm(true)} className="bg-[#fb8500] text-white text-sm font-bold px-4 py-2 rounded-xl">
            + ตั้ง KPI
          </button>
        )}
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-lg"
        >‹</button>
        <span className="flex-1 text-center font-semibold text-sm">{MONTH_NAMES[month]} {year + 543}</span>
        <button
          onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-lg"
        >›</button>
      </div>

      {loading ? (
        <div className="text-center text-[#f8f1e5]/40 text-sm py-10">กำลังโหลด...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center text-[#f8f1e5]/30 text-sm py-16">ยังไม่มี KPI เดือนนี้</div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([name, items]) => (
            <div key={name}>
              {canManage && <p className="text-xs font-semibold text-[#f8f1e5]/50 mb-2 uppercase tracking-wide">{name}</p>}
              <div className="flex flex-col gap-3">
                {items.map((kpi) => {
                  const pct = Math.min(100, kpi.target > 0 ? (kpi.actual / kpi.target) * 100 : 0);
                  const done = pct >= 100;
                  return (
                    <div key={kpi.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <p className="font-semibold text-sm">{kpi.title}</p>
                        {canManage && (
                          <button onClick={() => deleteKpi(kpi.id)} className="text-[#f8f1e5]/20 text-xs hover:text-red-400 shrink-0">✕</button>
                        )}
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full mb-2">
                        <div
                          className={`h-2 rounded-full transition-all ${done ? "bg-emerald-400" : "bg-[#fb8500]"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${done ? "text-emerald-400" : "text-[#fb8500]"}`}>
                          {kpi.actual} / {kpi.target} {kpi.unit}
                        </span>
                        {canManage && (
                          editId === kpi.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={editActual}
                                onChange={(e) => setEditActual(e.target.value)}
                                className="w-20 bg-white/10 rounded-lg px-2 py-1 text-sm text-center outline-none"
                                autoFocus
                              />
                              <button onClick={() => saveActual(kpi.id)} className="text-xs text-emerald-400 font-bold">บันทึก</button>
                              <button onClick={() => setEditId(null)} className="text-xs text-[#f8f1e5]/40">ยกเลิก</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditId(kpi.id); setEditActual(String(kpi.actual)); }}
                              className="text-xs text-[#f8f1e5]/40 hover:text-[#f8f1e5] border border-white/10 px-2.5 py-1 rounded-lg"
                            >
                              แก้ไขผล
                            </button>
                          )
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

      {/* Create KPI form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="w-full bg-[#1e3357] rounded-t-3xl p-6 flex flex-col gap-4">
            <h2 className="font-bold">ตั้ง KPI ใหม่</h2>
            <div>
              <label className="text-xs text-[#f8f1e5]/50 mb-1 block">พนักงาน</label>
              <select
                value={form.staffId}
                onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
                className="w-full bg-white/10 rounded-xl px-4 py-3 text-sm outline-none"
              >
                <option value="">เลือกพนักงาน</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="ชื่อ KPI เช่น ยอดขาย, ลูกค้าใหม่"
              className="bg-white/10 rounded-xl px-4 py-3 text-sm outline-none placeholder:text-[#f8f1e5]/30" />
            <div className="flex gap-3">
              <input type="number" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                placeholder="เป้าหมาย"
                className="flex-1 bg-white/10 rounded-xl px-4 py-3 text-sm outline-none placeholder:text-[#f8f1e5]/30" />
              <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="หน่วย เช่น บาท, คน"
                className="flex-1 bg-white/10 rounded-xl px-4 py-3 text-sm outline-none placeholder:text-[#f8f1e5]/30" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-sm">ยกเลิก</button>
              <button onClick={createKpi} disabled={saving || !form.title || !form.target || !form.unit || !form.staffId}
                className="flex-1 py-3 rounded-xl bg-[#fb8500] text-white font-bold text-sm disabled:opacity-50">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      <StaffNav />
    </div>
  );
}
