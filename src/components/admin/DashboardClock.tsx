"use client";

import { useEffect, useState } from "react";

const DAY_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export function DashboardClock() {
  const [display, setDisplay] = useState({ time: "", day: "" });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      // Bangkok = UTC+7; getTimezoneOffset returns local offset in minutes
      const bkk = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60_000);
      const hh = String(bkk.getHours()).padStart(2, "0");
      const mm = String(bkk.getMinutes()).padStart(2, "0");
      const ss = String(bkk.getSeconds()).padStart(2, "0");
      setDisplay({ time: `${hh}:${mm}:${ss}`, day: DAY_TH[bkk.getDay()] });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!display.time) return null;

  return (
    <div className="bg-navy rounded-2xl px-4 py-3 shadow-sm flex flex-col justify-center overflow-hidden">
      <p className="text-white/60 text-xs">เวลาปัจจุบัน</p>
      <p
        className="font-mono font-bold text-cream tracking-widest whitespace-nowrap"
        style={{ fontSize: "clamp(1rem, 3.5vw, 1.75rem)" }}
      >
        {display.time}
      </p>
      <p className="text-white/70 text-xs">วัน{display.day}</p>
    </div>
  );
}
