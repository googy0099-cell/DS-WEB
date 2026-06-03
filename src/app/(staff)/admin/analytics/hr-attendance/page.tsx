"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type StaffSummary = {
  id: number;
  name: string;
  summary: {
    daysWorked: number;
    onTimeCount: number;
    lateCount: number;
    earlyLeaveCount: number;
    workMinutes: number;
  };
};

const MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function hoursLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}ชม. ${m}น.`;
}

export default function HrAttendanceAnalyticsPage() {
  const today = new Date();
  const bkk = new Date(today.getTime() + 7 * 60 * 60 * 1000);
  const [year, setYear] = useState(bkk.getUTCFullYear());
  const [month, setMonth] = useState(bkk.getUTCMonth() + 1);
  const [staff, setStaff] = useState<StaffSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/hr/payroll?year=${year}&month=${month}`);
    if (res.status === 401) {
      setError("ต้องเป็นเจ้าของร้านเท่านั้น");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setStaff(data.staff ?? []);
    setError("");
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totals = staff.reduce(
    (acc, s) => ({
      daysWorked: acc.daysWorked + s.summary.daysWorked,
      onTime: acc.onTime + s.summary.onTimeCount,
      late: acc.late + s.summary.lateCount,
      early: acc.early + s.summary.earlyLeaveCount,
      minutes: acc.minutes + s.summary.workMinutes,
    }),
    { daysWorked: 0, onTime: 0, late: 0, early: 0, minutes: 0 }
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Link href="/admin/analytics" className="text-orange text-xs">← วิเคราะห์ข้อมูล</Link>
          <h1 className="text-xl font-bold text-navy">การเข้างานพนักงาน</h1>
        </div>
      </div>

      {/* Month picker */}
      <div className="flex gap-2 mb-4">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm"
        >
          {MONTH_LABELS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-sand rounded-xl px-3 py-2 text-sm"
        >
          {[year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>{y + 543}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-center text-gray-400 text-sm">กำลังโหลด...</p>}
      {error && <p className="text-center text-red-500 text-sm">{error}</p>}

      {!loading && !error && (
        <>
          {/* Aggregate totals */}
          <div className="bg-white rounded-2xl border border-sand/50 p-4 mb-4">
            <p className="text-xs text-gray-400 mb-2">รวมทีม</p>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <p className="text-gray-400">ทำงาน</p>
                <p className="font-bold text-navy text-lg">{totals.daysWorked}</p>
              </div>
              <div>
                <p className="text-gray-400">ตรงเวลา</p>
                <p className="font-bold text-emerald-600 text-lg">{totals.onTime}</p>
              </div>
              <div>
                <p className="text-gray-400">สาย</p>
                <p className="font-bold text-yellow-600 text-lg">{totals.late}</p>
              </div>
              <div>
                <p className="text-gray-400">ออกก่อน</p>
                <p className="font-bold text-orange text-lg">{totals.early}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              ชั่วโมงทำงานรวม {hoursLabel(totals.minutes)}
            </p>
          </div>

          {/* Per-staff list */}
          <div className="space-y-3">
            {staff.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">ยังไม่มีข้อมูล</p>
            ) : (
              staff.map((s) => (
                <div key={s.id} className="bg-white border border-sand/50 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-navy">{s.name}</p>
                    <p className="text-xs text-gray-400">
                      ทำงาน {s.summary.daysWorked} วัน
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2">
                    <div className="bg-emerald-50 rounded-lg py-2">
                      <p className="text-gray-500">ตรงเวลา</p>
                      <p className="font-bold text-emerald-700">{s.summary.onTimeCount}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg py-2">
                      <p className="text-gray-500">สาย</p>
                      <p className="font-bold text-yellow-700">{s.summary.lateCount}</p>
                    </div>
                    <div className="bg-orange/10 rounded-lg py-2">
                      <p className="text-gray-500">ออกก่อน</p>
                      <p className="font-bold text-orange">{s.summary.earlyLeaveCount}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    ชั่วโมงทำงาน {hoursLabel(s.summary.workMinutes)}
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
