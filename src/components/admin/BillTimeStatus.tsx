"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type PosSession = { id: number; nickname: string; packageType: string; timeRemaining: number; status: string; };
type PosBill = { id: number; name: string; color: string; prepRemaining: number; table: { number: number }; sessions: PosSession[]; };

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
    if (s.timeRemaining >= 86400) continue;
    const rem = Math.max(0, s.timeRemaining - elapsedSec);
    if (rem === 0) hasExpired = true;
    else if (rem <= 600) hasWarning = true;
  }
  if (hasExpired) return "expired";
  if (hasWarning) return "warning";
  return "ok";
}

const CARD_BORDER: Record<string, string> = {
  expired: "ring-2 ring-red-300",
  warning: "ring-2 ring-yellow-300",
  ok: "",
  prep: "",
};

export default function BillTimeStatus() {
  const { data: bills } = useSWR<PosBill[]>("/api/pos/bills", fetcher, { refreshInterval: 5000 });
  const lastFetchRef = useRef(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);

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

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-bold text-navy">สถานะตี้</h2>
        <span className="text-gray-400 text-xs font-normal">{bills.length} ตี้</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {bills.map((bill) => {
          const dispPrep = Math.max(0, bill.prepRemaining - elapsedSec);
          const inPrep = dispPrep > 0;
          const status = worstStatus(bill.sessions, elapsedSec, inPrep);
          return (
            <div key={bill.id} className={`bg-white rounded-2xl p-4 shadow-sm ${CARD_BORDER[status]}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">โต๊ะ {bill.table.number}</p>
                  <p className="font-bold text-navy text-sm truncate">{bill.name}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-2">{bill.sessions.length} คน</span>
              </div>
              {inPrep ? (
                <div className="bg-sky-50 text-sky-700 text-xs rounded-xl px-3 py-1.5 text-center font-semibold">
                  เตรียมตัว — เริ่มใน {fmt(dispPrep)}
                </div>
              ) : (
                <div className="space-y-1">
                  {bill.sessions.map((s) => {
                    const rem = s.timeRemaining >= 86400 ? s.timeRemaining : Math.max(0, s.timeRemaining - elapsedSec);
                    const badge = timeBadge(rem, false);
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-700 truncate flex-1">{s.nickname}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>{badge.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
