"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import DateRangePicker from "@/components/admin/DateRangePicker";

function todayBKK() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
function addDays(d: string, n: number) {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type DrawerSession = {
  id: number;
  date: string;
  openingFloat: number;
  countedCash: number | null;
  difference: number | null;
  closedBy: { username: string } | null;
};

export default function DrawerReportPage() {
  const today = todayBKK();
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);

  const { data, isLoading } = useSWR<{ sessions: DrawerSession[] }>(
    `/api/analytics/drawer?from=${from}&to=${to}`,
    fetcher,
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/analytics" className="text-gray-400 hover:text-navy text-sm">← กลับ</Link>
        <h1 className="text-xl font-bold text-navy">รายงานลิ้นชัก</h1>
      </div>

      <div className="mb-4">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sand text-xs text-gray-400">
              <th className="text-left p-3 pl-4">วันที่</th>
              <th className="text-right p-3">เงินเริ่ม</th>
              <th className="text-right p-3">นับได้</th>
              <th className="text-right p-3 pr-4">ขาด/เกิน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand/50">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}><td colSpan={4} className="p-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
              ))
            ) : !data?.sessions.length ? (
              <tr><td colSpan={4} className="text-center text-gray-400 py-10">ไม่มีข้อมูลในช่วงนี้</td></tr>
            ) : (
              data.sessions.map((s) => {
                const diff = s.difference;
                return (
                  <tr key={s.id} className="hover:bg-sand/20">
                    <td className="p-3 pl-4">
                      <p className="font-medium text-navy">{s.date}</p>
                      {s.closedBy && <p className="text-xs text-gray-400">{s.closedBy.username}</p>}
                    </td>
                    <td className="p-3 text-right text-gray-600">฿{s.openingFloat.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-600">
                      {s.countedCash !== null ? `฿${s.countedCash.toLocaleString()}` : "—"}
                    </td>
                    <td className={`p-3 pr-4 text-right font-semibold ${
                      diff === null ? "text-gray-400" :
                      diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-500"
                    }`}>
                      {diff === null ? "—" : diff === 0 ? "สมดุล" : `${diff > 0 ? "+" : ""}฿${diff.toLocaleString()}`}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
