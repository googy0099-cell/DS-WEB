"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const MONTH_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const TYPE_LABELS: Record<string, string> = {
  SALARY: "เงินเดือน",
  BONUS: "โบนัส",
  ADVANCE: "เบิกล่วงหน้า",
  COMMISSION: "ค่าคอมมิชชั่น",
  OTHER: "อื่นๆ",
};

const TYPE_COLORS: Record<string, string> = {
  SALARY: "bg-blue-100 text-blue-700 border-blue-200",
  BONUS: "bg-green-100 text-green-700 border-green-200",
  ADVANCE: "bg-amber-100 text-amber-700 border-amber-200",
  COMMISSION: "bg-purple-100 text-purple-700 border-purple-200",
  OTHER: "bg-gray-100 text-gray-600 border-gray-200",
};

type PaymentEvent = {
  id: number;
  staffId: number | null;
  staffName: string | null;
  date: string;
  amount: number;
  description: string;
  type: string;
  isPaid: boolean;
  paidAt: string | null;
  note: string | null;
};

type StaffOption = { id: number; name: string };

type NewEvent = {
  staffId: string;
  date: string;
  amount: string;
  description: string;
  type: string;
  note: string;
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default function PaymentCalendarPage() {
  const now = new Date(Date.now() + 7 * 3600_000);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [newEvent, setNewEvent] = useState<NewEvent>({
    staffId: "", date: "", amount: "", description: "", type: "SALARY", note: "",
  });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/hr/payment-calendar?year=${year}&month=${month}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "โหลดไม่สำเร็จ"); return; }
      setEvents(Array.isArray(data) ? data : []);
    } catch { setError("โหลดข้อมูลไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [year, month]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/hr/staff");
      if (!res.ok) return;
      const data = await res.json();
      setStaffList((Array.isArray(data) ? data : []).map((s: { id: number; name: string }) => ({
        id: s.id, name: s.name,
      })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  function openAdd(date: string) {
    setAddDate(date);
    setNewEvent({ staffId: "", date, amount: "", description: "", type: "SALARY", note: "" });
    setShowAdd(true);
  }

  async function saveEvent() {
    if (!newEvent.date || !newEvent.amount || !newEvent.description) return;
    setSaving(true);
    const res = await fetch("/api/hr/payment-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffId: newEvent.staffId ? Number(newEvent.staffId) : null,
        date: newEvent.date,
        amount: Number(newEvent.amount),
        description: newEvent.description,
        type: newEvent.type,
        note: newEvent.note || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "บันทึกไม่สำเร็จ"); return; }
    setShowAdd(false);
    fetchEvents();
  }

  async function togglePaid(event: PaymentEvent) {
    await fetch("/api/hr/payment-calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event.id, isPaid: !event.isPaid }),
    });
    fetchEvents();
  }

  async function deleteEvent(id: number) {
    if (!confirm("ลบรายการนี้?")) return;
    await fetch("/api/hr/payment-calendar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchEvents();
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const days = daysInMonth(year, month);
  const totalPending = events.filter(e => !e.isPaid).reduce((s, e) => s + e.amount, 0);
  const totalPaid = events.filter(e => e.isPaid).reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-orange text-xs">← Admin</Link>
          <h1 className="text-xl font-bold text-navy">ปฏิทินการจ่ายเงิน</h1>
        </div>
      </div>

      {error && <p className="mb-4 text-red-500 text-sm bg-red-50 rounded-xl py-2 px-3">{error}</p>}

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4 bg-white border border-sand/50 rounded-2xl p-3">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-navy font-bold">‹</button>
        <div className="text-center">
          <p className="font-bold text-navy">{MONTH_TH[month - 1]} {year + 543}</p>
          {!loading && (
            <p className="text-xs text-gray-400">
              ค้างจ่าย ฿{totalPending.toLocaleString()} · จ่ายแล้ว ฿{totalPaid.toLocaleString()}
            </p>
          )}
        </div>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-navy font-bold">›</button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-8">กำลังโหลด...</p>
      ) : (
        <div className="space-y-2">
          {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayEvents = events.filter(e => e.date === dateStr);
            const isToday = dateStr === now.toISOString().slice(0, 10);

            return (
              <div key={day} className={`bg-white border rounded-2xl p-3 ${isToday ? "border-orange/50" : "border-sand/40"}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${isToday ? "text-orange" : "text-navy"}`}>
                      {day}
                    </span>
                    {isToday && <span className="text-[10px] bg-orange text-white px-1.5 py-0.5 rounded-full">วันนี้</span>}
                    {dayEvents.length > 0 && (
                      <span className="text-xs text-gray-400">
                        ฿{dayEvents.reduce((s, e) => s + e.amount, 0).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => openAdd(dateStr)}
                    className="text-xs text-orange font-bold px-2 py-1 rounded-lg hover:bg-orange/10"
                  >
                    + เพิ่ม
                  </button>
                </div>

                {dayEvents.length > 0 && (
                  <div className="space-y-1.5 mt-1">
                    {dayEvents.map((ev) => (
                      <div key={ev.id}
                        className={`flex items-center gap-2 rounded-xl px-2.5 py-2 border ${ev.isPaid ? "opacity-60" : ""} ${TYPE_COLORS[ev.type] ?? TYPE_COLORS.OTHER}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold">{ev.description}</span>
                            {ev.staffName && (
                              <span className="text-[10px] opacity-70">{ev.staffName}</span>
                            )}
                            {!ev.staffName && (
                              <span className="text-[10px] opacity-70">ทุกคน</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-semibold">฿{ev.amount.toLocaleString()}</span>
                            <span className="text-[10px] opacity-60">{TYPE_LABELS[ev.type] ?? ev.type}</span>
                            {ev.isPaid && <span className="text-[10px] font-medium">✓ จ่ายแล้ว</span>}
                          </div>
                          {ev.note && <p className="text-[10px] opacity-60 mt-0.5">{ev.note}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => togglePaid(ev)}
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${ev.isPaid ? "border-gray-300 text-gray-500" : "border-current"}`}
                          >
                            {ev.isPaid ? "ยกเลิก" : "จ่ายแล้ว"}
                          </button>
                          <button onClick={() => deleteEvent(ev.id)} className="text-[10px] text-red-400 px-1">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Event Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center p-4 z-50 sm:items-center">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-lg text-navy mb-3">เพิ่มรายการจ่ายเงิน</h3>
            <p className="text-xs text-gray-400 mb-3">วันที่ {addDate}</p>

            <label className="block text-sm text-gray-600 mb-1">พนักงาน</label>
            <select value={newEvent.staffId} onChange={e => setNewEvent({ ...newEvent, staffId: e.target.value })}
              className="w-full border border-sand rounded-xl px-3 py-2 text-sm mb-3">
              <option value="">ทุกคน (ไม่ระบุ)</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <label className="block text-sm text-gray-600 mb-1">รายการ</label>
            <input value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
              placeholder="เช่น เงินเดือนมิถุนายน, โบนัส..."
              className="w-full border border-sand rounded-xl px-3 py-2 text-sm mb-3" />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">จำนวน (฿)</label>
                <input type="number" min={0} value={newEvent.amount}
                  onChange={e => setNewEvent({ ...newEvent, amount: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">ประเภท</label>
                <select value={newEvent.type} onChange={e => setNewEvent({ ...newEvent, type: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="block text-sm text-gray-600 mb-1">หมายเหตุ (ไม่บังคับ)</label>
            <input value={newEvent.note} onChange={e => setNewEvent({ ...newEvent, note: e.target.value })}
              className="w-full border border-sand rounded-xl px-3 py-2 text-sm mb-4" />

            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-gray-100 rounded-xl text-sm font-bold">ยกเลิก</button>
              <button onClick={saveEvent} disabled={saving || !newEvent.description || !newEvent.amount}
                className="flex-1 py-2 bg-orange text-white rounded-xl text-sm font-bold disabled:opacity-60">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
