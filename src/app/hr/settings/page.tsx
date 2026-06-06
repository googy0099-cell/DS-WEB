"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import HrNav from "@/components/hr/HrNav";

type Config = {
  deductionType: string;
  deductionAmount: number;
  lateDeductionMax: number;
  absentDeductionAmount: number;
  absentDeductionType: string;
  taskDeductionAmount: number;
  taskDeductionType: string;
};

function TypeToggle({
  value, onChange, unitLabel,
}: { value: "FIXED" | "PERCENT"; onChange: (v: "FIXED" | "PERCENT") => void; unitLabel: string }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-white/20 mb-3 text-sm font-semibold">
      <button
        onClick={() => onChange("FIXED")}
        className={`flex-1 py-2 transition-colors ${value === "FIXED" ? "bg-[#fb8500] text-white" : "text-[#f8f1e5]/60 hover:text-[#f8f1e5]"}`}
      >
        ฿ / {unitLabel}
      </button>
      <button
        onClick={() => onChange("PERCENT")}
        className={`flex-1 py-2 transition-colors ${value === "PERCENT" ? "bg-[#fb8500] text-white" : "text-[#f8f1e5]/60 hover:text-[#f8f1e5]"}`}
      >
        % / {unitLabel}
      </button>
    </div>
  );
}

export default function HrSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string })?.role;

  const [config, setConfig] = useState<Config>({
    deductionType: "FIXED", deductionAmount: 0, lateDeductionMax: 0,
    absentDeductionAmount: 0, absentDeductionType: "FIXED",
    taskDeductionAmount: 0, taskDeductionType: "FIXED",
  });
  const [lateType, setLateType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [lateStr, setLateStr] = useState("0");
  const [lateMaxStr, setLateMaxStr] = useState("0");
  const [absentType, setAbsentType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [absentStr, setAbsentStr] = useState("0");
  const [taskType, setTaskType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [taskStr, setTaskStr] = useState("0");
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
    setLateMaxStr(String(data.lateDeductionMax ?? 0));
    setAbsentType(data.absentDeductionType === "PERCENT" ? "PERCENT" : "FIXED");
    setAbsentStr(String(data.absentDeductionAmount));
    setTaskType(data.taskDeductionType === "PERCENT" ? "PERCENT" : "FIXED");
    setTaskStr(String(data.taskDeductionAmount));
  }, []);

  useEffect(() => { if (role === "OWNER") fetchConfig(); }, [role, fetchConfig]);

  async function save(field: "late" | "absent" | "task") {
    setSaving(true);
    setMsg("");
    const body =
      field === "late"
        ? { deductionType: lateType, deductionAmount: Math.max(0, Number(lateStr) || 0), lateDeductionMax: Math.max(0, Number(lateMaxStr) || 0) }
        : field === "absent"
        ? { absentDeductionType: absentType, absentDeductionAmount: Math.max(0, Number(absentStr) || 0) }
        : { taskDeductionType: taskType, taskDeductionAmount: Math.max(0, Number(taskStr) || 0) };

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
      <div className="px-4 py-6 max-w-lg mx-auto pb-28">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">ตั้งค่า HR</h1>
          {msg && <p className={`text-sm font-semibold ${msg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{msg}</p>}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5 space-y-4">
          <div>
            <h2 className="font-bold text-lg mb-1">การหักเงิน</h2>
            <p className="text-xs text-[#f8f1e5]/50">ตั้ง 0 = ไม่หัก</p>
          </div>

          {/* Late */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⏰</span>
              <p className="font-semibold">หักมาสาย</p>
            </div>
            <TypeToggle value={lateType} onChange={setLateType} unitLabel="นาที" />
            <p className="text-xs text-[#f8f1e5]/50 mb-3">
              {lateType === "FIXED"
                ? "จำนวนบาทที่หักต่อนาทีที่สาย เช่น 5 = หัก ฿5 ต่อนาที"
                : "% ของค่าจ้างรายวันต่อนาทีที่สาย เช่น 1 = หัก 1% ต่อนาที"}
            </p>
            <div className="flex gap-2 items-center mb-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f8f1e5]/50">{lateType === "FIXED" ? "฿" : "%"}</span>
                <input type="number" min={0} value={lateStr} onChange={(e) => setLateStr(e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-xl pl-7 pr-3 py-2.5 text-[#f8f1e5] focus:outline-none focus:border-[#fb8500]" placeholder="0" />
              </div>
              <button onClick={() => save("late")} disabled={saving}
                className="px-4 py-2.5 bg-[#fb8500] rounded-xl font-bold text-sm disabled:opacity-50 shrink-0">บันทึก</button>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs font-semibold text-[#f8f1e5]/80 mb-0.5">ยอดหักสูงสุด / ครั้ง</p>
                <p className="text-xs text-[#f8f1e5]/40">0 = ไม่จำกัด</p>
              </div>
              <div className="relative w-28">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f8f1e5]/50 text-sm">฿</span>
                <input type="number" min={0} value={lateMaxStr} onChange={(e) => setLateMaxStr(e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-xl pl-7 pr-2 py-2 text-[#f8f1e5] text-sm focus:outline-none focus:border-[#fb8500]" placeholder="0" />
              </div>
            </div>
            {config.deductionAmount > 0 && (
              <p className="text-xs text-[#fb8500] mt-2">
                ปัจจุบัน: {config.deductionType === "PERCENT"
                  ? `${config.deductionAmount}% ของค่าจ้างรายวัน / นาที`
                  : `฿${config.deductionAmount.toLocaleString()} / นาที`}
                {config.lateDeductionMax > 0 && ` · สูงสุด ฿${config.lateDeductionMax.toLocaleString()}`}
              </p>
            )}
          </div>

          {/* Absent */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🚫</span>
              <p className="font-semibold">หักขาดงาน</p>
            </div>
            <TypeToggle value={absentType} onChange={setAbsentType} unitLabel="วัน" />
            <p className="text-xs text-[#f8f1e5]/50 mb-3">
              {absentType === "FIXED"
                ? "จำนวนบาทที่หักต่อวันที่ขาด"
                : "% ของค่าจ้างรายวันต่อวันที่ขาด"}
            </p>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f8f1e5]/50">{absentType === "FIXED" ? "฿" : "%"}</span>
                <input type="number" min={0} value={absentStr} onChange={(e) => setAbsentStr(e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-xl pl-7 pr-3 py-2.5 text-[#f8f1e5] focus:outline-none focus:border-[#fb8500]" placeholder="0" />
              </div>
              <button onClick={() => save("absent")} disabled={saving}
                className="px-4 py-2.5 bg-[#fb8500] rounded-xl font-bold text-sm disabled:opacity-50 shrink-0">บันทึก</button>
            </div>
            {config.absentDeductionAmount > 0 && (
              <p className="text-xs text-[#fb8500] mt-2">
                ปัจจุบัน: {config.absentDeductionType === "PERCENT"
                  ? `${config.absentDeductionAmount}% ของค่าจ้างรายวัน / วัน`
                  : `฿${config.absentDeductionAmount.toLocaleString()} / วัน`}
              </p>
            )}
          </div>

          {/* Task overdue */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📋</span>
              <p className="font-semibold">หักงานเกินกำหนด</p>
            </div>
            <TypeToggle value={taskType} onChange={setTaskType} unitLabel="วัน" />
            <p className="text-xs text-[#f8f1e5]/50 mb-3">
              {taskType === "FIXED"
                ? "จำนวนบาทต่อ 1 วันที่เกินกำหนด (คูณจำนวนวันที่เกิน)"
                : "% ของค่าจ้างรายวันต่อวันที่เกินกำหนด"}
            </p>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f8f1e5]/50">{taskType === "FIXED" ? "฿" : "%"}</span>
                <input type="number" min={0} value={taskStr} onChange={(e) => setTaskStr(e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-xl pl-7 pr-3 py-2.5 text-[#f8f1e5] focus:outline-none focus:border-[#fb8500]" placeholder="0" />
              </div>
              <button onClick={() => save("task")} disabled={saving}
                className="px-4 py-2.5 bg-[#fb8500] rounded-xl font-bold text-sm disabled:opacity-50 shrink-0">บันทึก</button>
            </div>
            {config.taskDeductionAmount > 0 && (
              <p className="text-xs text-[#fb8500] mt-2">
                ปัจจุบัน: {config.taskDeductionType === "PERCENT"
                  ? `${config.taskDeductionAmount}% ของค่าจ้างรายวัน × จำนวนวันที่เกิน`
                  : `฿${config.taskDeductionAmount.toLocaleString()} × จำนวนวันที่เกิน`}
              </p>
            )}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-[#f8f1e5]/60">
          <p className="font-semibold text-[#f8f1e5]/80 mb-2">หมายเหตุ</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>การหักสายเกิดขึ้นทันทีเมื่อพนักงานเช็คอินสาย</li>
            <li>การหักขาดงาน / งานเกินกำหนด ต้องกดยืนยันจาก HR Dashboard</li>
            <li>% คิดจากค่าจ้างรายวัน (รายวัน = baseSalary, รายเดือน ÷ 30, รายชั่วโมง × 8)</li>
            <li>Grace period ตั้งได้ที่ ตารางพนักงาน</li>
            <li>ดูและลบรายการหักได้ที่หน้า เงินเดือน</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
