"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import HrNav from "@/components/hr/HrNav";

type Config = { deductionType: string; deductionAmount: number; absentDeductionAmount: number };

export default function HrSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string })?.role;

  const [config, setConfig] = useState<Config>({ deductionType: "FIXED", deductionAmount: 0, absentDeductionAmount: 0 });
  const [lateType, setLateType] = useState<"FIXED" | "PERCENT">("FIXED");
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
    setLateType(data.deductionType === "PERCENT" ? "PERCENT" : "FIXED");
    setLateStr(String(data.deductionAmount));
    setAbsentStr(String(data.absentDeductionAmount));
  }, []);

  useEffect(() => { if (role === "OWNER") fetchConfig(); }, [role, fetchConfig]);

  async function save(field: "late" | "absent") {
    setSaving(true);
    setMsg("");
    const body = field === "late"
      ? { deductionType: lateType, deductionAmount: Math.max(0, Number(lateStr) || 0) }
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

  const latePreview = config.deductionAmount > 0
    ? config.deductionType === "PERCENT"
      ? `${config.deductionAmount}% ของค่าจ้างรายวัน / นาที`
      : `฿${config.deductionAmount.toLocaleString()} / นาที`
    : null;

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-[#f8f1e5]/40 text-sm">กำลังโหลด...</div>;
  }

  return (
    <div className="min-h-screen bg-[#182a47] text-[#f8f1e5]">
      <HrNav />
      <div className="px-4 py-6 max-w-lg mx-auto pb-28">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">ตั้งค่า HR</h1>
          {msg && <p className={`text-sm font-semibold ${msg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{msg}</p>}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
          <h2 className="font-bold text-lg mb-1">การหักเงิน</h2>
          <p className="text-xs text-[#f8f1e5]/50 mb-4">ตั้ง 0 = ไม่หัก</p>

          {/* Late */}
          <div className="bg-white/5 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⏰</span>
              <p className="font-semibold">หักมาสาย</p>
            </div>

            {/* Type toggle */}
            <div className="flex rounded-xl overflow-hidden border border-white/20 mb-3 text-sm font-semibold">
              <button
                onClick={() => setLateType("FIXED")}
                className={`flex-1 py-2 transition-colors ${lateType === "FIXED" ? "bg-[#fb8500] text-white" : "text-[#f8f1e5]/60 hover:text-[#f8f1e5]"}`}
              >
                ฿ / นาที
              </button>
              <button
                onClick={() => setLateType("PERCENT")}
                className={`flex-1 py-2 transition-colors ${lateType === "PERCENT" ? "bg-[#fb8500] text-white" : "text-[#f8f1e5]/60 hover:text-[#f8f1e5]"}`}
              >
                % / นาที
              </button>
            </div>

            <p className="text-xs text-[#f8f1e5]/50 mb-3">
              {lateType === "FIXED"
                ? "จำนวนบาทที่หักต่อนาทีที่สาย เช่น 5 = หัก ฿5 ต่อนาที"
                : "% ของค่าจ้างรายวันต่อนาทีที่สาย เช่น 1 = หัก 1% ของค่าจ้างรายวัน ต่อนาที"}
            </p>

            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f8f1e5]/50">
                  {lateType === "FIXED" ? "฿" : "%"}
                </span>
                <input
                  type="number" min={0} value={lateStr}
                  onChange={(e) => setLateStr(e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-xl pl-7 pr-3 py-2.5 text-[#f8f1e5] focus:outline-none focus:border-[#fb8500]"
                  placeholder="0"
                />
              </div>
              <button onClick={() => save("late")} disabled={saving}
                className="px-4 py-2.5 bg-[#fb8500] rounded-xl font-bold text-sm disabled:opacity-50 shrink-0">
                บันทึก
              </button>
            </div>

            {latePreview && (
              <p className="text-xs text-[#fb8500] mt-2">ปัจจุบัน: {latePreview}</p>
            )}
          </div>

          {/* Absent */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🚫</span>
              <p className="font-semibold">หักขาดงาน</p>
            </div>
            <p className="text-xs text-[#f8f1e5]/50 mb-3">จำนวนบาทที่หักต่อวันที่ขาด</p>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f8f1e5]/50">฿</span>
                <input
                  type="number" min={0} value={absentStr}
                  onChange={(e) => setAbsentStr(e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-xl pl-7 pr-3 py-2.5 text-[#f8f1e5] focus:outline-none focus:border-[#fb8500]"
                  placeholder="0"
                />
              </div>
              <button onClick={() => save("absent")} disabled={saving}
                className="px-4 py-2.5 bg-[#fb8500] rounded-xl font-bold text-sm disabled:opacity-50 shrink-0">
                บันทึก
              </button>
            </div>
            {config.absentDeductionAmount > 0 && (
              <p className="text-xs text-[#fb8500] mt-2">ปัจจุบัน: −฿{config.absentDeductionAmount.toLocaleString()} / วัน</p>
            )}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-[#f8f1e5]/60">
          <p className="font-semibold text-[#f8f1e5]/80 mb-2">หมายเหตุ</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>การหักสายเกิดขึ้นทันทีเมื่อพนักงานเช็คอินสาย</li>
            <li>% คิดจากค่าจ้างรายวัน (รายวัน = baseSalary, รายเดือน ÷ 30, รายชั่วโมง × 8)</li>
            <li>Grace period ตั้งได้ที่ ตารางพนักงาน</li>
            <li>ดูและลบรายการหักได้ที่หน้า เงินเดือน</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
