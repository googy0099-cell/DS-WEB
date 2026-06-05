"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Schedule = { dayOfWeek: number; startTime: string; endTime: string; graceMinutes: number };
type StaffSchedules = { id: number; name: string; schedules: Schedule[] };

const DAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAY_LABELS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

const PRESETS = [
  { label: "จ–ศ", days: [1, 2, 3, 4, 5] },
  { label: "ส–อา", days: [6, 0] },
  { label: "ทุกวัน", days: [0, 1, 2, 3, 4, 5, 6] },
];

type DayEdit = { staffId: number; dayOfWeek: number; startTime: string; endTime: string; graceMinutes: number };
type BatchEdit = { staffId: number; name: string; days: Set<number>; startTime: string; endTime: string; graceMinutes: number };

export default function AdminHrSchedulePage() {
  const [staff, setStaff] = useState<StaffSchedules[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dayEdit, setDayEdit] = useState<DayEdit | null>(null);
  const [batch, setBatch] = useState<BatchEdit | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/schedule?t=${Date.now()}`);
      if (res.status === 401) { setError("ต้องเป็นเจ้าของร้านเท่านั้น"); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? `เกิดข้อผิดพลาด (${res.status})`); return; }
      setStaff(Array.isArray(data) ? data : []);
    } catch { setError("โหลดข้อมูลไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function applyScheduleToState(staffId: number, dayOfWeek: number, sc: Schedule) {
    setStaff((prev) => prev.map((s) => {
      if (s.id !== staffId) return s;
      const exists = s.schedules.some((x) => x.dayOfWeek === dayOfWeek);
      return {
        ...s,
        schedules: exists
          ? s.schedules.map((x) => x.dayOfWeek === dayOfWeek ? sc : x)
          : [...s.schedules, sc].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
      };
    }));
  }

  function removeScheduleFromState(staffId: number, dayOfWeek: number) {
    setStaff((prev) => prev.map((s) =>
      s.id !== staffId ? s : { ...s, schedules: s.schedules.filter((x) => x.dayOfWeek !== dayOfWeek) }
    ));
  }

  async function saveDayEdit() {
    if (!dayEdit) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/hr/schedule", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dayEdit),
      });
      const d = await res.json().catch(() => ({})) as { error?: string; startTime?: string; endTime?: string; graceMinutes?: number };
      if (!res.ok) {
        setError(d.error ?? `บันทึกไม่สำเร็จ (${res.status})`);
        return;
      }
      applyScheduleToState(dayEdit.staffId, dayEdit.dayOfWeek, {
        dayOfWeek: dayEdit.dayOfWeek,
        startTime: d.startTime ?? dayEdit.startTime,
        endTime: d.endTime ?? dayEdit.endTime,
        graceMinutes: d.graceMinutes ?? dayEdit.graceMinutes,
      });
      setDayEdit(null);
    } catch (e) {
      setError(`เชื่อมต่อไม่ได้: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteDay(staffId: number, dayOfWeek: number) {
    if (!confirm(`ลบตารางวัน${DAY_LABELS[dayOfWeek]}?`)) return;
    await fetch("/api/hr/schedule", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, dayOfWeek }),
    });
    removeScheduleFromState(staffId, dayOfWeek);
  }

  async function saveBatch() {
    if (!batch || batch.days.size === 0) return;
    setSaving(true);
    await Promise.all([...batch.days].map((day) =>
      fetch("/api/hr/schedule", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: batch.staffId, dayOfWeek: day, startTime: batch.startTime, endTime: batch.endTime, graceMinutes: batch.graceMinutes }),
      })
    ));
    setSaving(false);
    [...batch.days].forEach((day) =>
      applyScheduleToState(batch.staffId, day, { dayOfWeek: day, startTime: batch.startTime, endTime: batch.endTime, graceMinutes: batch.graceMinutes })
    );
    setBatch(null);
  }

  function toggleBatchDay(day: number) {
    if (!batch) return;
    const next = new Set(batch.days);
    if (next.has(day)) next.delete(day); else next.add(day);
    setBatch({ ...batch, days: next });
  }

  function applyPreset(days: number[]) {
    if (!batch) return;
    setBatch({ ...batch, days: new Set(days) });
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-orange text-xs">← Admin</Link>
          <h1 className="text-xl font-bold text-navy">ตารางเวลาพนักงาน</h1>
        </div>
      </div>

      {error && <p className="mb-4 text-red-500 text-sm bg-red-50 rounded-xl py-2 px-3">{error}</p>}

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-8">กำลังโหลด...</p>
      ) : staff.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">ยังไม่มีพนักงาน</p>
      ) : (
        <div className="space-y-4">
          {staff.map((s) => {
            const scMap = Object.fromEntries(s.schedules.map((x) => [x.dayOfWeek, x]));
            return (
              <div key={s.id} className="bg-white border border-sand/50 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-navy">{s.name}</h2>
                  <button
                    onClick={() => setBatch({ staffId: s.id, name: s.name, days: new Set(), startTime: "10:00", endTime: "22:00", graceMinutes: 10 })}
                    className="text-xs px-3 py-1.5 bg-orange text-white rounded-lg font-bold"
                  >
                    ตั้งหลายวัน
                  </button>
                </div>

                {/* 7-day grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const sc = scMap[day];
                    return (
                      <button
                        key={day}
                        onClick={() => setDayEdit({
                          staffId: s.id, dayOfWeek: day,
                          startTime: sc?.startTime ?? "10:00",
                          endTime: sc?.endTime ?? "22:00",
                          graceMinutes: sc?.graceMinutes ?? 10,
                        })}
                        className={`flex flex-col items-center py-2 px-1 rounded-xl text-xs transition-colors ${
                          sc
                            ? "bg-orange/15 border border-orange/40 text-orange"
                            : "bg-gray-50 border border-sand/30 text-gray-400 hover:border-orange/30"
                        }`}
                      >
                        <span className="font-bold">{DAY_SHORT[day]}</span>
                        <span className="text-[10px] mt-0.5 leading-tight">
                          {sc ? sc.startTime : "ปิด"}
                        </span>
                        {sc && (
                          <span className="text-[9px] leading-tight opacity-70">{sc.endTime}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {s.schedules.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    {s.schedules.length} วัน/สัปดาห์ · กดวันเพื่อแก้ไข
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Single day edit modal */}
      {dayEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-navy">วัน{DAY_LABELS[dayEdit.dayOfWeek]}</h3>
              {staff.find(s => s.id === dayEdit.staffId)?.schedules.find(x => x.dayOfWeek === dayEdit.dayOfWeek) && (
                <button onClick={() => { deleteDay(dayEdit.staffId, dayEdit.dayOfWeek); setDayEdit(null); }}
                  className="text-xs text-red-400 font-medium">ลบวันนี้</button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">เริ่มงาน</label>
                <input type="time" value={dayEdit.startTime}
                  onChange={(e) => setDayEdit({ ...dayEdit, startTime: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">เลิกงาน</label>
                <input type="time" value={dayEdit.endTime}
                  onChange={(e) => setDayEdit({ ...dayEdit, endTime: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm" />
              </div>
            </div>

            <label className="block text-sm text-gray-600 mb-1">เผื่อสาย (นาที)</label>
            <input type="number" min={0} max={60} value={dayEdit.graceMinutes}
              onChange={(e) => setDayEdit({ ...dayEdit, graceMinutes: Number(e.target.value) })}
              className="w-full mb-4 border border-sand rounded-xl px-3 py-2 text-sm" />

            {error && <p className="text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>}

            <div className="flex gap-2">
              <button onClick={() => { setDayEdit(null); setError(""); }} className="flex-1 py-2 bg-gray-100 rounded-xl text-sm font-bold">ยกเลิก</button>
              <button onClick={saveDayEdit} disabled={saving} className="flex-1 py-2 bg-orange text-white rounded-xl text-sm font-bold disabled:opacity-60">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch set modal */}
      {batch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-lg text-navy mb-1">ตั้งหลายวัน — {batch.name}</h3>
            <p className="text-xs text-gray-400 mb-3">เลือกวันแล้วใส่เวลาเดียวกันทั้งหมด</p>

            {/* Quick presets */}
            <div className="flex gap-2 mb-3">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => applyPreset(p.days)}
                  className="px-3 py-1 bg-navy/10 text-navy text-xs font-bold rounded-lg">
                  {p.label}
                </button>
              ))}
            </div>

            {/* Day toggles */}
            <div className="grid grid-cols-7 gap-1.5 mb-4">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <button key={day} onClick={() => toggleBatchDay(day)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                    batch.days.has(day)
                      ? "bg-orange text-white border-orange"
                      : "bg-white text-gray-500 border-sand hover:border-orange/40"
                  }`}>
                  {DAY_SHORT[day]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">เริ่มงาน</label>
                <input type="time" value={batch.startTime}
                  onChange={(e) => setBatch({ ...batch, startTime: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">เลิกงาน</label>
                <input type="time" value={batch.endTime}
                  onChange={(e) => setBatch({ ...batch, endTime: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm" />
              </div>
            </div>

            <label className="block text-sm text-gray-600 mb-1">เผื่อสาย (นาที)</label>
            <input type="number" min={0} max={60} value={batch.graceMinutes}
              onChange={(e) => setBatch({ ...batch, graceMinutes: Number(e.target.value) })}
              className="w-full mb-4 border border-sand rounded-xl px-3 py-2 text-sm" />

            {batch.days.size > 0 && (
              <p className="text-xs text-orange mb-3 font-medium">
                เลือก {batch.days.size} วัน: {[...batch.days].sort().map(d => DAY_SHORT[d]).join(", ")}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setBatch(null)} className="flex-1 py-2 bg-gray-100 rounded-xl text-sm font-bold">ยกเลิก</button>
              <button onClick={saveBatch} disabled={saving || batch.days.size === 0}
                className="flex-1 py-2 bg-orange text-white rounded-xl text-sm font-bold disabled:opacity-60">
                {saving ? "กำลังบันทึก..." : `บันทึก ${batch.days.size} วัน`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
