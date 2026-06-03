"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Status = { done: number; total: number };
type ChecklistStatus = { OPEN: Status; CLOSE: Status };

export default function ChecklistStatusBanner() {
  const [status, setStatus] = useState<ChecklistStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/hr/checklist/today-status")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, []);

  if (dismissed || !status) return null;

  const openIncomplete = status.OPEN.total > 0 && status.OPEN.done < status.OPEN.total;
  const closeIncomplete = status.CLOSE.total > 0 && status.CLOSE.done < status.CLOSE.total;

  if (!openIncomplete && !closeIncomplete) return null;

  return (
    <div className="mb-4 bg-amber-50 border border-amber-300 rounded-2xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          {openIncomplete && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-700">🌅 เปิดร้าน</span>
              <span className="text-xs text-amber-600">
                ทำแล้ว {status.OPEN.done}/{status.OPEN.total} รายการ
              </span>
              <div className="flex-1 h-1.5 bg-amber-200 rounded-full overflow-hidden">
                <div className="h-1.5 bg-amber-500 rounded-full" style={{ width: `${(status.OPEN.done / status.OPEN.total) * 100}%` }} />
              </div>
            </div>
          )}
          {closeIncomplete && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-700">🌙 ปิดร้าน</span>
              <span className="text-xs text-amber-600">
                ทำแล้ว {status.CLOSE.done}/{status.CLOSE.total} รายการ
              </span>
              <div className="flex-1 h-1.5 bg-amber-200 rounded-full overflow-hidden">
                <div className="h-1.5 bg-amber-500 rounded-full" style={{ width: `${(status.CLOSE.done / status.CLOSE.total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link href="/hr/checklist" className="text-[10px] text-amber-700 font-bold px-2 py-1 rounded-lg border border-amber-400/60">
            ทำเช็คลิสต์
          </Link>
          <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 text-lg leading-none px-1">✕</button>
        </div>
      </div>
    </div>
  );
}
