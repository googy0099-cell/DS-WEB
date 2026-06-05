"use client";

import { useEffect, useState, useCallback } from "react";

type Config = { deductionType: string; deductionAmount: number; absentDeductionAmount: number };

export default function AdminHrSettingsPage() {
  const [config, setConfig] = useState<Config>({ deductionType: "FIXED", deductionAmount: 0, absentDeductionAmount: 0 });
  const [lateType, setLateType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [lateStr, setLateStr] = useState("0");
  const [absentStr, setAbsentStr] = useState("0");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchConfig = useCallback(async () => {
    const res = await fetch("/api/hr/attendance/config");
    if (!res.ok) return;
    const data: Config = await res.json();
    setConfig(data);
    setLateType(data.deductionType === "PERCENT" ? "PERCENT" : "FIXED");
    setLateStr(String(data.deductionAmount));
    setAbsentStr(String(data.absentDeductionAmount));
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

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

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">ตั้งค่า HR</h1>
          <p className="text-gray-400 text-xs mt-0.5">กำหนดเงื่อนไขการหักเงินพนักงาน</p>
        </div>
        {msg && <p className={`text-sm font-semibold ${msg.startsWith("✓") ? "text-emerald-600" : "text-red-500"}`}>{msg}</p>}
      </div>

      <div className="bg-white border border-sand/50 rounded-2xl p-5 mb-4">
        <h2 className="font-bold text-navy mb-1">การหักเงิน</h2>
        <p className="text-xs text-gray-400 mb-5">ตั้ง 0 = ไม่หัก</p>

        {/* Late */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⏰</span>
            <p className="font-semibold text-navy">หักมาสาย</p>
          </div>

          {/* Type toggle */}
          <div className="flex rounded-xl overflow-hidden border border-sand mb-3 text-sm font-semibold">
            <button
              onClick={() => setLateType("FIXED")}
              className={`flex-1 py-2 transition-colors ${lateType === "FIXED" ? "bg-orange text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >
              ฿ / นาที
            </button>
            <button
              onClick={() => setLateType("PERCENT")}
              className={`flex-1 py-2 transition-colors ${lateType === "PERCENT" ? "bg-orange text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >
              % / นาที
            </button>
          </div>

          <p className="text-xs text-gray-500 mb-3">
            {lateType === "FIXED"
              ? "จำนวนบาทที่หักต่อนาทีที่สาย เช่น 5 = หัก ฿5 ต่อนาที"
              : "% ของค่าจ้างรายวันต่อนาทีที่สาย เช่น 1 = หัก 1% ของค่าจ้างรายวัน ต่อนาที"}
          </p>

          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                {lateType === "FIXED" ? "฿" : "%"}
              </span>
              <input
                type="number" min={0} value={lateStr}
                onChange={(e) => setLateStr(e.target.value)}
                className="w-full border border-sand rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:border-orange"
                placeholder="0"
              />
            </div>
            <button onClick={() => save("late")} disabled={saving}
              className="px-4 py-2.5 bg-orange text-white rounded-xl font-bold text-sm disabled:opacity-50 shrink-0">
              บันทึก
            </button>
          </div>

          {latePreview && (
            <p className="text-xs text-orange mt-2 font-medium">ปัจจุบัน: {latePreview}</p>
          )}
        </div>

        {/* Absent */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🚫</span>
            <p className="font-semibold text-navy">หักขาดงาน</p>
          </div>
          <p className="text-xs text-gray-500 mb-3">จำนวนบาทที่หักต่อวันที่ขาด (กดยืนยันจาก HR Dashboard)</p>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">฿</span>
              <input
                type="number" min={0} value={absentStr}
                onChange={(e) => setAbsentStr(e.target.value)}
                className="w-full border border-sand rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:border-orange"
                placeholder="0"
              />
            </div>
            <button onClick={() => save("absent")} disabled={saving}
              className="px-4 py-2.5 bg-orange text-white rounded-xl font-bold text-sm disabled:opacity-50 shrink-0">
              บันทึก
            </button>
          </div>
          {config.absentDeductionAmount > 0 && (
            <p className="text-xs text-orange mt-2 font-medium">ปัจจุบัน: −฿{config.absentDeductionAmount.toLocaleString()} / วัน</p>
          )}
        </div>
      </div>

      <div className="bg-cream border border-sand/50 rounded-2xl p-4 text-sm text-gray-600">
        <p className="font-semibold text-navy mb-2">หมายเหตุ</p>
        <ul className="space-y-1.5 list-disc list-inside text-xs text-gray-500">
          <li>การหักสายเกิดขึ้นทันทีเมื่อพนักงานเช็คอินสาย</li>
          <li>% คิดจากค่าจ้างรายวัน (รายวัน = baseSalary, รายเดือน ÷ 30, รายชั่วโมง × 8)</li>
          <li>การหักขาดงานต้องกดยืนยันจาก HR Dashboard</li>
          <li>ดูและลบรายการหักได้ที่หน้า เงินเดือน</li>
          <li>Grace period ตั้งได้ที่ ตารางพนักงาน</li>
        </ul>
      </div>
    </div>
  );
}
