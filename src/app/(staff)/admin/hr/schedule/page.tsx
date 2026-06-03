"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Schedule = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  graceMinutes: number;
};

type StaffSchedules = {
  id: number;
  name: string;
  schedules: Schedule[];
};

const DAY_LABELS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

export default function AdminHrSchedulePage() {
  const [staff, setStaff] = useState<StaffSchedules[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{
    staffId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    graceMinutes: number;
  } | null>(null);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hr/schedule");
      if (res.status === 401) { setError("ต้องเป็นเจ้าของร้านเท่านั้น"); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? `เกิดข้อผิดพลาด (${res.status})`); return; }
      setStaff(Array.isArray(data) ? data : []);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveSchedule() {
    if (!editing) return;
    const res = await fetch("/api/hr/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setEditing(null);
    setError("");
    fetchData();
  }

  async function deleteSchedule(staffId: number, dayOfWeek: number) {
    if (!confirm(`ลบตารางวัน${DAY_LABELS[dayOfWeek]}?`)) return;
    await fetch("/api/hr/schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, dayOfWeek }),
    });
    fetchData();
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-orange text-xs">← Admin</Link>
          <h1 className="text-xl font-bold text-navy">ตารางเวลาพนักงาน</h1>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-red-500 text-sm bg-red-50 rounded-xl py-2 px-3">{error}</p>
      )}

      {loading ? (
        <p className="text-center text-gray-400 text-sm">กำลังโหลด...</p>
      ) : (
        <div className="space-y-4">
          {staff.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">ยังไม่มีพนักงาน</p>
          ) : staff.map((s) => (
            <div key={s.id} className="bg-white border border-sand/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-navy">{s.name}</h2>
                <button
                  onClick={() => setEditing({ staffId: s.id, dayOfWeek: 1, startTime: "10:00", endTime: "22:00", graceMinutes: 10 })}
                  className="text-xs px-3 py-1 bg-orange text-white rounded-lg font-bold"
                >
                  + เพิ่มวัน
                </button>
              </div>

              {s.schedules.length === 0 ? (
                <p className="text-gray-400 text-sm">ยังไม่มีตารางงาน</p>
              ) : (
                <div className="space-y-2">
                  {s.schedules.map((sc) => (
                    <div key={sc.dayOfWeek} className="flex items-center justify-between bg-gray-50 border border-sand/30 rounded-xl px-3 py-2">
                      <div className="text-sm">
                        <span className="font-bold text-navy">{DAY_LABELS[sc.dayOfWeek]}</span>
                        <span className="text-gray-500 ml-2">{sc.startTime} – {sc.endTime}</span>
                        <span className="text-gray-400 ml-2 text-xs">(สาย +{sc.graceMinutes}น.)</span>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setEditing({ staffId: s.id, dayOfWeek: sc.dayOfWeek, startTime: sc.startTime, endTime: sc.endTime, graceMinutes: sc.graceMinutes })}
                          className="text-xs text-orange font-medium"
                        >
                          แก้
                        </button>
                        <button onClick={() => deleteSchedule(s.id, sc.dayOfWeek)} className="text-xs text-red-400 font-medium">
                          ลบ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-lg text-navy mb-4">ตั้งตารางงาน</h3>

            <label className="block text-sm text-gray-600 mb-1">วัน</label>
            <select
              value={editing.dayOfWeek}
              onChange={(e) => setEditing({ ...editing, dayOfWeek: Number(e.target.value) })}
              className="w-full mb-3 border border-sand rounded-xl px-3 py-2 text-sm"
            >
              {DAY_LABELS.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>

            <label className="block text-sm text-gray-600 mb-1">เริ่มงาน</label>
            <input type="time" value={editing.startTime}
              onChange={(e) => setEditing({ ...editing, startTime: e.target.value })}
              className="w-full mb-3 border border-sand rounded-xl px-3 py-2 text-sm"
            />

            <label className="block text-sm text-gray-600 mb-1">เลิกงาน</label>
            <input type="time" value={editing.endTime}
              onChange={(e) => setEditing({ ...editing, endTime: e.target.value })}
              className="w-full mb-3 border border-sand rounded-xl px-3 py-2 text-sm"
            />

            <label className="block text-sm text-gray-600 mb-1">เผื่อสาย (นาที)</label>
            <input type="number" min={0} max={60} value={editing.graceMinutes}
              onChange={(e) => setEditing({ ...editing, graceMinutes: Number(e.target.value) })}
              className="w-full mb-4 border border-sand rounded-xl px-3 py-2 text-sm"
            />

            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-2 bg-gray-100 rounded-xl text-sm font-bold">ยกเลิก</button>
              <button onClick={saveSchedule} className="flex-1 py-2 bg-orange text-white rounded-xl text-sm font-bold">บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
