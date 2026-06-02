"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type PosSession = { id: number; nickname: string; packageType: string; timeRemaining: number; status: string; };
type PosBill = { id: number; name: string; color: string; prepRemaining: number; table: { number: number }; sessions: PosSession[]; };

const COLOR_MAP: Record<string, { chip: string; ring: string }> = {
  indigo:  { chip: "bg-indigo-600 text-white",  ring: "ring-indigo-400" },
  emerald: { chip: "bg-emerald-600 text-white", ring: "ring-emerald-400" },
  rose:    { chip: "bg-rose-600 text-white",    ring: "ring-rose-400" },
  amber:   { chip: "bg-amber-500 text-white",   ring: "ring-amber-400" },
  violet:  { chip: "bg-violet-600 text-white",  ring: "ring-violet-400" },
  teal:    { chip: "bg-teal-600 text-white",    ring: "ring-teal-400" },
  sky:     { chip: "bg-sky-500 text-white",     ring: "ring-sky-400" },
  pink:    { chip: "bg-pink-500 text-white",    ring: "ring-pink-400" },
};
const DEFAULT_COLOR = { chip: "bg-gray-600 text-white", ring: "ring-gray-400" };

function fmt(secs: number) {
  if (secs >= 86400) return "∞";
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeBadge(secs: number, inPrep: boolean) {
  if (inPrep) return { cls: "bg-sky-100 text-sky-700", label: "เตรียมตัว" };
  if (secs >= 86400) return { cls: "bg-purple-100 text-purple-700", label: "เหมาวัน" };
  if (secs > 600) return { cls: "bg-green-100 text-green-700", label: fmt(secs) };
  if (secs > 0) return { cls: "bg-yellow-100 text-yellow-800", label: fmt(secs) };
  return { cls: "bg-red-100 text-red-700 font-bold", label: "หมดเวลา!" };
}

function worstStatus(sessions: PosSession[], elapsedSec: number, inPrep: boolean) {
  if (inPrep) return "prep";
  let hasExpired = false, hasWarning = false;
  for (const s of sessions) {
    if (s.packageType === "MANUAL") continue;
    if (s.timeRemaining >= 86400) continue;
    const rem = Math.max(0, s.timeRemaining - elapsedSec);
    if (rem === 0) hasExpired = true;
    else if (rem <= 600) hasWarning = true;
  }
  if (hasExpired) return "expired";
  if (hasWarning) return "warning";
  return "ok";
}

export default function BillTimeStatus() {
  const { data: bills } = useSWR<PosBill[]>("/api/pos/bills", fetcher, { refreshInterval: 5000 });
  const lastFetchRef = useRef(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!bills) return;
    lastFetchRef.current = Date.now();
    setElapsedSec(0);
  }, [bills]);

  useEffect(() => {
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - lastFetchRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  if (!bills || bills.length === 0) return null;

  const expanded = expandedId !== null ? bills.find((b) => b.id === expandedId) ?? null : null;
  const dispPrepExpanded = expanded ? Math.max(0, expanded.prepRemaining - elapsedSec) : 0;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="font-bold text-navy text-sm">สถานะตี้</h2>
        <span className="text-gray-400 text-xs">{bills.length} ตี้</span>
      </div>

      {/* Compact chip row */}
      <div className="flex flex-wrap gap-2">
        {bills.map((bill) => {
          const dispPrep = Math.max(0, bill.prepRemaining - elapsedSec);
          const inPrep = dispPrep > 0;
          const status = worstStatus(bill.sessions, elapsedSec, inPrep);
          const c = COLOR_MAP[bill.color] ?? DEFAULT_COLOR;
          const isOpen = expandedId === bill.id;

          const dot =
            status === "expired" ? "🔴" :
            status === "warning" ? "🟡" :
            status === "prep"    ? "🔵" : null;

          return (
            <button
              key={bill.id}
              onClick={() => setExpandedId(isOpen ? null : bill.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${c.chip} ${isOpen ? `ring-2 ${c.ring} ring-offset-1` : "opacity-90 hover:opacity-100"}`}
            >
              {dot && <span className="text-[10px] leading-none">{dot}</span>}
              <span className="truncate max-w-[80px]">{bill.name}</span>
              <span className="text-[10px] opacity-70">{isOpen ? "▲" : "▼"}</span>
            </button>
          );
        })}
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="mt-2 bg-white rounded-2xl shadow-sm p-3 border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${(COLOR_MAP[expanded.color] ?? DEFAULT_COLOR).chip}`}>
              ตี้ {expanded.name}
            </span>
            <span className="text-xs text-gray-400">โต๊ะ {expanded.table.number} · {expanded.sessions.length} คน</span>
          </div>
          {dispPrepExpanded > 0 ? (
            <div className="bg-sky-50 text-sky-700 text-xs rounded-xl px-3 py-1.5 text-center font-semibold">
              เตรียมตัว — เริ่มใน {fmt(dispPrepExpanded)}
            </div>
          ) : (
            <div className="space-y-1">
              {expanded.sessions.map((s) => {
                if (s.packageType === "MANUAL") {
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-700 truncate flex-1">{s.nickname}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">เพิ่มเติม</span>
                    </div>
                  );
                }
                const rem = s.timeRemaining >= 86400 ? s.timeRemaining : Math.max(0, s.timeRemaining - elapsedSec);
                const badge = timeBadge(rem, false);
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-700 truncate flex-1">{s.nickname}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
