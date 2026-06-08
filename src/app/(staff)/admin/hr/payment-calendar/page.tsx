"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const MONTH_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

type EventType = "SALARY" | "BONUS" | "ADVANCE" | "COMMISSION" | "HOLIDAY" | "APPOINTMENT" | "OTHER";

type CalEvent = {
  id: number;
  staffId: number | null;
  staffName: string | null;
  date: string;
  amount: number;
  description: string;
  type: EventType;
  recurrence: string | null;
  notifyDaysBefore: number | null;
  isRecurring: boolean;
  isPaid: boolean;
  note: string | null;
};

type CalcDeduction = { id: number; amount: number; reason: string; note: string | null };

type StaffCalc = {
  staffId: number;
  name: string;
  payType: string;
  payRate: number;
  fromDate: string;
  daysWorked: number;
  workMinutes: number;
  gross: number;
  deductions: CalcDeduction[];
  totalDeductions: number;
  net: number;
  checked: boolean;
  customAmount: string;
  loading: boolean;
};

type StaffOption = { id: number; name: string };

const EVENT_STYLE: Record<string, string> = {
  SALARY:      "bg-blue-500 text-white",
  BONUS:       "bg-emerald-500 text-white",
  ADVANCE:     "bg-amber-500 text-white",
  COMMISSION:  "bg-purple-500 text-white",
  HOLIDAY:     "bg-red-400 text-white",
  APPOINTMENT: "bg-orange-400 text-white",
  OTHER:       "bg-gray-400 text-white",
};

const EVENT_LABEL: Record<string, string> = {
  SALARY:      "เงินเดือน",
  BONUS:       "โบนัส",
  ADVANCE:     "เบิก",
  COMMISSION:  "คอมมิชชั่น",
  HOLIDAY:     "วันหยุด",
  APPOINTMENT: "นัดหมาย",
  OTHER:       "อื่นๆ",
};

const PAY_TYPES: EventType[] = ["SALARY", "BONUS", "ADVANCE", "COMMISSION", "OTHER"];
const SPECIAL_TYPES: EventType[] = ["HOLIDAY", "APPOINTMENT"];
const PAY_TYPE_UNIT: Record<string, string> = { MONTHLY: "/เดือน", DAILY: "/วัน", HOURLY: "/ชม." };

function thb(n: number) { return n.toLocaleString("th-TH"); }

function renderNote(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    part.match(/^https?:\/\//)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer"
           className="text-orange underline break-all hover:text-orange/80">{part}</a>
      : <span key={i}>{part}</span>
  );
}

function buildGrid(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function PaymentCalendarPage() {
  const bkkNow = new Date(Date.now() + 7 * 3600_000);
  const todayStr = bkkNow.toISOString().slice(0, 10);

  const [year, setYear] = useState(bkkNow.getUTCFullYear());
  const [month, setMonth] = useState(bkkNow.getUTCMonth() + 1);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add modal
  const [modal, setModal] = useState<null | { date: string }>(null);
  const [tab, setTab] = useState<"payment" | "special">("payment");
  const [payType, setPayType] = useState<EventType>("SALARY");
  const [recurrence, setRecurrence] = useState(false);
  const [specialType, setSpecialType] = useState<EventType>("HOLIDAY");
  const [specialTitle, setSpecialTitle] = useState("");
  const [specialNote, setSpecialNote] = useState("");
  const [specialRecurrence, setSpecialRecurrence] = useState(false);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState<string>("");
  const [staffCalcs, setStaffCalcs] = useState<StaffCalc[]>([]);
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [detail, setDetail] = useState<CalEvent | null>(null);
  const [confirmDeleteRecurring, setConfirmDeleteRecurring] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true); setError("");
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
      setStaffOptions(Array.isArray(data) ? data.map((s: StaffOption) => ({ id: s.id, name: s.name })) : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  function openModal(dateStr: string) {
    setModal({ date: dateStr });
    setTab("payment");
    setPayType("SALARY");
    setRecurrence(false);
    setSpecialType("HOLIDAY");
    setSpecialTitle("");
    setSpecialNote("");
    setSpecialRecurrence(false);
    setNotifyDaysBefore("");
    setStaffCalcs(staffOptions.map(s => ({
      staffId: s.id, name: s.name, payType: "", payRate: 0,
      fromDate: "", daysWorked: 0, workMinutes: 0, gross: 0,
      deductions: [], totalDeductions: 0, net: 0,
      checked: false, customAmount: "", loading: false,
    })));
  }

  async function calcStaff(idx: number, date: string) {
    setStaffCalcs(prev => prev.map((s, i) => i === idx ? { ...s, loading: true } : s));
    try {
      const res = await fetch(`/api/hr/payment-calendar/calculate?staffId=${staffCalcs[idx].staffId}&toDate=${date}`);
      const data = await res.json();
      if (res.ok) {
        setStaffCalcs(prev => prev.map((s, i) => i === idx ? {
          ...s, loading: false,
          payType: data.payType, payRate: data.payRate,
          fromDate: data.fromDate, daysWorked: data.daysWorked,
          workMinutes: data.workMinutes, gross: data.gross,
          deductions: data.deductions ?? [], totalDeductions: data.totalDeductions ?? 0,
          net: data.net ?? data.gross,
          customAmount: String(data.net ?? data.gross), // pay NET by default
        } : s));
      } else {
        setStaffCalcs(prev => prev.map((s, i) => i === idx ? { ...s, loading: false } : s));
      }
    } catch {
      setStaffCalcs(prev => prev.map((s, i) => i === idx ? { ...s, loading: false } : s));
    }
  }

  function toggleStaff(idx: number) {
    const next = staffCalcs.map((s, i) => i === idx ? { ...s, checked: !s.checked } : s);
    setStaffCalcs(next);
    if (!next[idx].checked) return;
    if (!next[idx].fromDate && modal?.date) calcStaff(idx, modal.date);
  }

  async function savePayment() {
    if (!modal) return;
    const selected = staffCalcs.filter(s => s.checked);
    if (selected.length === 0) return;
    setSaving(true);
    await Promise.all(selected.map(s =>
      fetch("/api/hr/payment-calendar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: s.staffId, date: modal.date,
          amount: Number(s.customAmount) || s.net,
          description: `${EVENT_LABEL[payType]} ${MONTH_TH[month - 1]}`,
          type: payType,
          recurrence: recurrence ? "MONTHLY" : null,
          note: s.fromDate ? `${s.fromDate} – ${modal.date}` : undefined,
        }),
      })
    ));
    setSaving(false);
    setModal(null);
    fetchEvents();
  }

  async function saveSpecial() {
    if (!modal || !specialTitle.trim()) return;
    setSaving(true);
    await fetch("/api/hr/payment-calendar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffId: null, date: modal.date, amount: 0,
        description: specialTitle.trim(), type: specialType,
        recurrence: specialRecurrence ? "MONTHLY" : null,
        notifyDaysBefore: notifyDaysBefore !== "" ? Number(notifyDaysBefore) : null,
        note: specialNote.trim() || undefined,
      }),
    });
    setSaving(false);
    setModal(null);
    fetchEvents();
  }

  async function togglePaid(ev: CalEvent) {
    await fetch("/api/hr/payment-calendar", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        ev.isRecurring
          ? { id: ev.id, isPaid: !ev.isPaid, recurringDate: ev.date }
          : { id: ev.id, isPaid: !ev.isPaid }
      ),
    });
    setDetail(prev => prev ? { ...prev, isPaid: !prev.isPaid } : null);
    fetchEvents();
  }

  async function deleteEvent(id: number, isRecurring: boolean, deleteAll: boolean) {
    await fetch("/api/hr/payment-calendar", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, deleteAll }),
    });
    setDetail(null);
    setConfirmDeleteRecurring(false);
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

  const grid = buildGrid(year, month);
  const totalPending = events.filter(e => !e.isPaid && e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalPaid = events.filter(e => e.isPaid && e.amount > 0).reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-orange text-xs">← Admin</Link>
          <h1 className="text-xl font-bold text-navy">ปฏิทินการจ่ายเงิน</h1>
        </div>
      </div>

      {error && <p className="mb-3 text-red-500 text-sm bg-red-50 rounded-xl py-2 px-3">{error}</p>}

      {/* Month nav */}
      <div className="bg-white border border-sand/50 rounded-2xl p-3 mb-3 flex items-center justify-between">
        <button onClick={prevMonth} className="w-9 h-9 rounded-xl hover:bg-gray-100 text-navy font-bold text-lg flex items-center justify-center">‹</button>
        <div className="text-center">
          <p className="font-bold text-navy">{MONTH_TH[month - 1]} {year + 543}</p>
          <p className="text-xs text-gray-400">ค้างจ่าย ฿{thb(totalPending)} · จ่ายแล้ว ฿{thb(totalPaid)}</p>
        </div>
        <button onClick={nextMonth} className="w-9 h-9 rounded-xl hover:bg-gray-100 text-navy font-bold text-lg flex items-center justify-center">›</button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(Object.keys(EVENT_LABEL) as EventType[]).map(t => (
          <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${EVENT_STYLE[t]}`}>
            {EVENT_LABEL[t]}
          </span>
        ))}
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-gray-300 text-gray-500">🔄 ทุกเดือน</span>
      </div>

      {/* Calendar grid */}
      <div className="bg-white border border-sand/40 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-sand/40">
          {DOW.map(d => (
            <div key={d} className="py-2 text-center text-xs font-bold text-gray-400">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {loading
            ? Array.from({ length: 35 }, (_, i) => (
                <div key={i} className="min-h-[80px] border-b border-r border-sand/30 p-1 animate-pulse bg-gray-50" />
              ))
            : grid.map((day, idx) => {
                const dateStr = day
                  ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  : "";
                const dayEvents = day ? events.filter(e => e.date === dateStr) : [];
                const isToday = dateStr === todayStr;
                const isWeekend = idx % 7 === 0 || idx % 7 === 6;

                return (
                  <div
                    key={idx}
                    onClick={() => day && openModal(dateStr)}
                    className={`min-h-[80px] border-b border-r border-sand/30 p-1 transition-colors ${
                      day ? "cursor-pointer hover:bg-orange/5" : "bg-gray-50/50"
                    } ${isWeekend && day ? "bg-blue-50/20" : ""}`}
                  >
                    {day && (
                      <>
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-0.5 ${
                          isToday ? "bg-orange text-white" : "text-navy"
                        }`}>
                          {day}
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 3).map(ev => (
                            <div
                              key={`${ev.id}-${ev.date}`}
                              onClick={e => { e.stopPropagation(); setDetail(ev); setConfirmDeleteRecurring(false); }}
                              className={`text-[9px] font-semibold px-1 py-0.5 rounded truncate leading-tight ${EVENT_STYLE[ev.type]} ${ev.isPaid ? "opacity-40" : ""}`}
                            >
                              {ev.isRecurring && <span className="mr-0.5">🔄</span>}
                              {ev.staffName ? ev.staffName.split(" ")[0] : ev.description.slice(0, 8)}
                              {ev.amount > 0 && ` ฿${ev.amount >= 1000 ? `${(ev.amount / 1000).toFixed(0)}k` : ev.amount}`}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-[9px] text-gray-400 pl-1">+{dayEvents.length - 3} อีก</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
          }
        </div>
      </div>

      {/* Add Event Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 sm:items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-sand/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-navy">เพิ่มรายการ · {modal.date}</h3>
                <button onClick={() => setModal(null)} className="text-gray-400 text-xl leading-none">✕</button>
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                <button onClick={() => setTab("payment")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === "payment" ? "bg-white text-navy shadow-sm" : "text-gray-500"}`}>
                  💰 จ่ายเงิน
                </button>
                <button onClick={() => setTab("special")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === "special" ? "bg-white text-navy shadow-sm" : "text-gray-500"}`}>
                  📌 วันหยุด/นัดหมาย
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {tab === "payment" ? (
                <>
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {PAY_TYPES.map(t => (
                      <button key={t} onClick={() => setPayType(t)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                          payType === t ? `${EVENT_STYLE[t]} border-transparent` : "border-sand text-gray-500"
                        }`}>
                        {EVENT_LABEL[t]}
                      </button>
                    ))}
                  </div>

                  {/* Recurrence toggle */}
                  <label className="flex items-center gap-2 mb-4 cursor-pointer">
                    <div
                      onClick={() => setRecurrence(r => !r)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${recurrence ? "bg-orange" : "bg-gray-200"}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${recurrence ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-sm text-gray-600">🔄 ทำซ้ำทุกเดือน <span className="text-xs text-gray-400">(ตั้งค่าครั้งเดียว)</span></span>
                  </label>

                  <p className="text-xs text-gray-500 mb-2">เลือกพนักงานที่ต้องจ่าย</p>
                  <div className="space-y-2">
                    {staffCalcs.map((s, idx) => (
                      <div key={s.staffId} className={`border rounded-xl p-3 transition-colors ${s.checked ? "border-orange/50 bg-orange/5" : "border-sand/50"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <input type="checkbox" checked={s.checked} onChange={() => toggleStaff(idx)}
                            className="accent-orange w-4 h-4" />
                          <span className="font-medium text-sm text-navy flex-1">{s.name}</span>
                          {s.checked && (
                            <button onClick={() => calcStaff(idx, modal.date)}
                              className="text-[10px] text-orange font-bold px-1.5 py-0.5 border border-orange/40 rounded-lg">
                              {s.loading ? "..." : "คำนวณ"}
                            </button>
                          )}
                        </div>
                        {s.checked && (
                          <>
                            {s.fromDate && (
                              <p className="text-[10px] text-gray-400 mb-1.5">
                                {s.fromDate} – {modal.date} · {s.daysWorked} วัน
                                {s.payType === "HOURLY" && ` · ${Math.round(s.workMinutes / 60 * 10) / 10} ชม.`}
                                {" "}· ฿{thb(s.payRate)}{PAY_TYPE_UNIT[s.payType] ?? ""}
                              </p>
                            )}
                            {s.fromDate && s.totalDeductions > 0 && (
                              <div className="mb-1.5 rounded-lg bg-red-50 border border-red-100 px-2 py-1.5 text-[10px]">
                                <div className="flex justify-between text-gray-500">
                                  <span>รายได้รวม</span><span>฿{thb(s.gross)}</span>
                                </div>
                                {s.deductions.map(d => (
                                  <div key={d.id} className="flex justify-between text-red-500">
                                    <span className="truncate pr-2">− {d.reason}</span>
                                    <span className="shrink-0">−฿{thb(d.amount)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between font-bold text-navy border-t border-red-100 mt-1 pt-1">
                                  <span>ยอดสุทธิ</span><span>฿{thb(s.net)}</span>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">จำนวน (฿)</span>
                              <input
                                type="number" value={s.customAmount}
                                onChange={e => setStaffCalcs(prev => prev.map((x, i) => i === idx ? { ...x, customAmount: e.target.value } : x))}
                                className="flex-1 border border-sand rounded-lg px-2 py-1 text-sm text-right font-bold"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    {SPECIAL_TYPES.map(t => (
                      <button key={t} onClick={() => setSpecialType(t)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                          specialType === t ? `${EVENT_STYLE[t]} border-transparent` : "border-sand text-gray-500"
                        }`}>
                        {t === "HOLIDAY" ? "🎌 วันหยุด" : "📌 นัดหมาย"}
                      </button>
                    ))}
                  </div>

                  {/* Recurrence toggle */}
                  <label className="flex items-center gap-2 mb-4 cursor-pointer">
                    <div
                      onClick={() => setSpecialRecurrence(r => !r)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${specialRecurrence ? "bg-orange" : "bg-gray-200"}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${specialRecurrence ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-sm text-gray-600">🔄 ทำซ้ำทุกเดือน</span>
                  </label>

                  <label className="block text-sm text-gray-600 mb-1">ชื่อ/รายละเอียด</label>
                  <input value={specialTitle} onChange={e => setSpecialTitle(e.target.value)}
                    placeholder={specialType === "HOLIDAY" ? "เช่น วันสงกรานต์, วันหยุดพิเศษ" : "เช่น ล้างแอร์, ล้างท่อ, เช็คระบบไฟ"}
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm mb-3" />

                  {/* Notify before */}
                  <label className="block text-sm text-gray-600 mb-1">🔔 แจ้งเตือน Telegram ล่วงหน้า</label>
                  <div className="flex gap-2 mb-3">
                    {["", "0", "1", "3", "7", "14"].map(v => (
                      <button key={v} onClick={() => setNotifyDaysBefore(v)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          notifyDaysBefore === v ? "bg-orange text-white border-orange" : "border-sand text-gray-500"
                        }`}>
                        {v === "" ? "ไม่แจ้ง" : v === "0" ? "วันนั้น" : v === "1" ? "1 วัน" : `${v} วัน`}
                      </button>
                    ))}
                  </div>

                  <label className="block text-sm text-gray-600 mb-1">หมายเหตุ / ลิงค์ (ไม่บังคับ)</label>
                  <textarea value={specialNote} onChange={e => setSpecialNote(e.target.value)}
                    rows={2} placeholder="https://... หรือข้อความทั่วไป"
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm resize-none" />
                </>
              )}
            </div>

            <div className="p-4 border-t border-sand/30 flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm font-bold">ยกเลิก</button>
              {tab === "payment" ? (
                <button onClick={savePayment}
                  disabled={saving || staffCalcs.filter(s => s.checked).length === 0}
                  className="flex-1 py-2.5 bg-orange text-white rounded-xl text-sm font-bold disabled:opacity-60">
                  {saving ? "กำลังบันทึก..." : `บันทึก${recurrence ? " 🔄" : ""} ${staffCalcs.filter(s => s.checked).length} คน`}
                </button>
              ) : (
                <button onClick={saveSpecial}
                  disabled={saving || !specialTitle.trim()}
                  className="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-bold disabled:opacity-60">
                  {saving ? "กำลังบันทึก..." : `บันทึก${specialRecurrence ? " 🔄" : ""}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 sm:items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${EVENT_STYLE[detail.type]}`}>
                    {EVENT_LABEL[detail.type]}
                  </span>
                  {detail.isRecurring && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">🔄 ทุกเดือน</span>
                  )}
                </div>
                <h3 className="font-bold text-navy mt-1">{detail.description}</h3>
              </div>
              <button onClick={() => { setDetail(null); setConfirmDeleteRecurring(false); }} className="text-gray-400 text-xl leading-none ml-3">✕</button>
            </div>

            <p className="text-sm text-gray-500 mb-1">📅 {detail.date}</p>
            {detail.staffName && <p className="text-sm text-gray-500 mb-1">👤 {detail.staffName}</p>}
            {detail.amount > 0 && <p className="text-2xl font-bold text-navy mb-1">฿{thb(detail.amount)}</p>}
            {detail.notifyDaysBefore !== null && detail.notifyDaysBefore !== undefined && (
              <p className="text-xs text-orange mb-1">
                🔔 แจ้งเตือนล่วงหน้า {detail.notifyDaysBefore === 0 ? "วันนั้น" : `${detail.notifyDaysBefore} วัน`}
              </p>
            )}
            {detail.note && !detail.note.startsWith("recurring:") && (
              <p className="text-xs text-gray-400 mb-3 leading-relaxed">{renderNote(detail.note)}</p>
            )}

            {detail.isPaid && (
              <div className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-2 rounded-xl mb-3">
                ✓ จ่ายแล้วในเดือนนี้
              </div>
            )}

            {/* Delete with recurring confirmation */}
            {!confirmDeleteRecurring ? (
              <div className="flex gap-2">
                <button
                  onClick={() => detail.isRecurring ? setConfirmDeleteRecurring(true) : (confirm("ลบรายการนี้?") && deleteEvent(detail.id, false, false))}
                  className="flex-1 py-2 border border-red-200 text-red-400 rounded-xl text-sm font-bold">
                  ลบ
                </button>
                {detail.amount > 0 && (
                  <button onClick={() => togglePaid(detail)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold ${detail.isPaid ? "bg-gray-100 text-gray-600" : "bg-emerald-500 text-white"}`}>
                    {detail.isPaid ? "ยกเลิกจ่าย" : "จ่ายแล้ว ✓"}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-3 font-medium">ลบรายการนี้อย่างไร?</p>
                <div className="space-y-2">
                  <button
                    onClick={() => deleteEvent(detail.id, true, true)}
                    className="w-full py-2 bg-red-500 text-white rounded-xl text-sm font-bold">
                    ลบทั้งหมดทุกเดือน
                  </button>
                  <button
                    onClick={() => setConfirmDeleteRecurring(false)}
                    className="w-full py-2 bg-gray-100 rounded-xl text-sm font-bold text-gray-600">
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
