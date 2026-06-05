"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import HrNav from "@/components/hr/HrNav";

type Config = { deductionAmount: number; absentDeductionAmount: number };

export default function HrSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string })?.role;

  const [config, setConfig] = useState<Config>({ deductionAmount: 0, absentDeductionAmount: 0 });
  const [lateStr, setLateStr] = useState("0");
  const [absentStr, setAbsentStr] = useState("0");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/api/auth/signin"); return; }
    if (status === "authenticated" && role !== "OWNER") { router.replace("/hr/checklist"); return; }
  }, [status, role, router]);

  const fetchConfig = useCallback(async () => {
    const res = await fetch("/api/hr/attendance/config");
    if (!res.ok) return;
    const data: Config = await res.json();
    setConfig(data);
    setLateStr(String(data.deductionAmount));
    setAbsentStr(String(data.absentDeductionAmount));
  }, []);

  useEffect(() => { if (role === "OWNER") fetchConfig(); }, [role, fetchConfig]);

  async function save(field: "late" | "absent") {
    setSaving(true);
    setMsg("");
    const body = field === "late"
      ? { deductionAmount: Math.max(0, Number(lateStr) || 0) }
      : { absentDeductionAmount: Math.max(0, Number(absentStr) || 0) };
    const res = await fetch("/api/hr/attendance/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      const data: Config = await res.json();
      setConfig(data);
      setMsg("✓ บันทึกแล้ว");
      setTimeout(() => setMsg(""), 2500);
    } else {
      setMsg("✗ บันทึกไม่สำเร็จ");
    }
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-[#f8f1e5]/40 text-sm">กำลังโหลด...</div>;
  }

  return (
    <div className="min-h-screen bg-[#182a47] text-[#f8f1e5]">
      <HrNav />
      <div className="px-4 py-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">ตั้งค่า HR</h1>
          {msg && <p className={`text-sm font-semibold ${msg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{msg}</p>}
        </div>

        {/* Deduction config */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
          <h2 className="font-bold text-lg mb-1">การหักเงิน</h2>
          <p className="text-xs text-[#f8f1e5]/50 mb-4">ตั้ง 0 = ไม่หัก</p>

          <div className="space-y-4">
            {/* Late deduction */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-yellow-400 text-lg">⏰</span>
                <p className="font-semibold">หักมาสาย</p>
              </div>
              <p className="text-xs text-[#f8f1e5]/50 mb-3">หักอัตโนมัติทุกครั้งที่เช็คอินสาย (เกิน grace period ในตารางงาน)</p>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f8f1e5]/50">฿</span>
                  <input
                    type="number"
                    min={0}
                    value={lateStr}
                    onChange={(e) => setLateStr(e.target.value)}
                    className="w-full bg-white/5 border border-white/20 rounded-xl pl-7 pr-3 py-2.5 text-[#f8f1e5] focus:outline-none focus:border-[#fb8500]"
                    placeholder="0"
                  />
                </div>
                <button
                  onClick={() => save("late")}
                  disabled={saving}
                  className="px-4 py-2.5 bg-[#fb8500] rounded-xl font-bold text-sm disabled:opacity-50 shrink-0"
                >
                  บันทึก
                </button>
              </div>
              {config.deductionAmount > 0 && (
                <p className="text-xs text-[#fb8500] mt-2">ปัจจุบัน: −฿{config.deductionAmount.toLocaleString()} / ครั้ง</p>
              )}
            </div>

            {/* Absent deduction */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-red-400 text-lg">🚫</span>
                <p className="font-semibold">หักขาดงาน</p>
              </div>
              <p className="text-xs text-[#f8f1e5]/50 mb-3">หักเมื่อกดยืนยันขาดงานจาก Dashboard (เฉพาะวันที่มีตารางงาน)</p>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f8f1e5]/50">฿</span>
                  <input
                    type="number"
                    min={0}
                    value={absentStr}
                    onChange={(e) => setAbsentStr(e.target.value)}
                    className="w-full bg-white/5 border border-white/20 rounded-xl pl-7 pr-3 py-2.5 text-[#f8f1e5] focus:outline-none focus:border-[#fb8500]"
                    placeholder="0"
                  />
                </div>
                <button
                  onClick={() => save("absent")}
                  disabled={saving}
                  className="px-4 py-2.5 bg-[#fb8500] rounded-xl font-bold text-sm disabled:opacity-50 shrink-0"
                >
                  บันทึก
                </button>
              </div>
              {config.absentDeductionAmount > 0 && (
                <p className="text-xs text-[#fb8500] mt-2">ปัจจุบัน: −฿{config.absentDeductionAmount.toLocaleString()} / วัน</p>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-[#f8f1e5]/60">
          <p className="font-semibold text-[#f8f1e5]/80 mb-2">หมายเหตุ</p>
          <ul className="space-y-1.5 list-disc list-inside text-xs">
            <li>การหักสายเกิดขึ้นทันทีเมื่อพนักงานเช็คอินสาย</li>
            <li>การหักขาดงานต้องกดยืนยันจาก HR Dashboard</li>
            <li>ดูรายการหักทั้งหมดได้ที่หน้า เงินเดือน</li>
            <li>ลบรายการหักได้จากหน้า เงินเดือน ถ้าต้องการยกเว้น</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
