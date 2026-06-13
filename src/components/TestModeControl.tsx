"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";

export default function TestModeControl({ active }: { active: boolean }) {
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "OWNER";
  const [busy, setBusy] = useState(false);

  async function setMode(on: boolean) {
    setBusy(true);
    await fetch("/api/test-mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on }) });
    location.reload();
  }

  async function clearData() {
    if (!confirm("ลบข้อมูลทดสอบทั้งหมดออกจากระบบ?\n(ข้อมูลจริงจะไม่ถูกแตะต้อง)")) return;
    setBusy(true);
    const res = await fetch("/api/test-mode/clear", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    alert(res.ok ? `ลบข้อมูลทดสอบแล้ว ${data.total ?? 0} รายการ` : "ลบไม่สำเร็จ");
  }

  // Active: full-width banner so it's impossible to forget you're in test mode.
  if (active) {
    return (
      <div className="sticky top-0 z-[60] bg-violet-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto flex items-center gap-2 px-3 py-2 text-sm">
          <span className="font-bold">🧪 โหมดทดสอบระบบ</span>
          <span className="hidden sm:inline text-white/80">— ข้อมูลที่ทำตอนนี้จะไม่ถูกนับในยอด/รายงานจริง</span>
          <div className="ml-auto flex items-center gap-2">
            {isOwner && (
              <button onClick={clearData} disabled={busy}
                className="bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-50">
                🧹 ล้างข้อมูลทดสอบ
              </button>
            )}
            <button onClick={() => setMode(false)} disabled={busy}
              className="bg-white text-violet-700 rounded-lg px-2.5 py-1 text-xs font-bold disabled:opacity-50">
              ออกจากโหมดทดสอบ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Inactive: no floating button — owner turns it on from the Settings page.
  return null;
}
