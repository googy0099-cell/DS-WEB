"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Appointment = {
  id: number;
  date: string;
  description: string;
  type: string;
  isRecurring: boolean;
  staffName: string | null;
};

const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTHS_TH[m - 1]} ${y + 543}`;
}

function daysUntil(dateStr: string) {
  const bkk = new Date(Date.now() + 7 * 3600_000);
  const today = bkk.toISOString().slice(0, 10);
  const diff = Math.round((new Date(`${dateStr}T00:00:00+07:00`).getTime() - new Date(`${today}T00:00:00+07:00`).getTime()) / 86400000);
  if (diff === 0) return "วันนี้";
  if (diff === 1) return "พรุ่งนี้";
  return `อีก ${diff} วัน`;
}

export default function AppointmentBanner() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/hr/today-appointments")
      .then(r => r.ok ? r.json() : [])
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  if (dismissed || items.length === 0) return null;

  const today = items.filter(a => daysUntil(a.date) === "วันนี้");
  const upcoming = items.filter(a => daysUntil(a.date) !== "วันนี้");

  return (
    <div className="mb-4 bg-orange/10 border border-orange/30 rounded-2xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {today.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-bold text-orange mb-1">📌 วันนี้</p>
              <div className="space-y-1">
                {today.map(a => (
                  <div key={`${a.id}-${a.date}`} className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${a.type === "HOLIDAY" ? "bg-red-100 text-red-600" : "bg-orange/20 text-orange"}`}>
                      {a.type === "HOLIDAY" ? "วันหยุด" : "นัดหมาย"}
                    </span>
                    <span className="text-sm font-medium text-navy truncate">{a.description}</span>
                    {a.isRecurring && <span className="text-[10px] text-gray-400">🔄</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              {today.length > 0 && <div className="border-t border-orange/20 my-2" />}
              <p className="text-xs font-bold text-gray-500 mb-1">📅 เร็วๆ นี้</p>
              <div className="space-y-1">
                {upcoming.slice(0, 3).map(a => (
                  <div key={`${a.id}-${a.date}`} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 w-16 shrink-0">{daysUntil(a.date)}</span>
                    <span className="text-xs text-gray-600 truncate">{a.description}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{formatDate(a.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link href="/admin/hr/payment-calendar" className="text-[10px] text-orange font-bold px-2 py-1 rounded-lg border border-orange/40">
            ดูปฏิทิน
          </Link>
          <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1">✕</button>
        </div>
      </div>
    </div>
  );
}
