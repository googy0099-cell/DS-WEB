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

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error("fetch failed");
  return r.json();
};
const RANKS = ["🥇", "🥈", "🥉"];

type MenuItem = { menuItemId: number; nameTh: string; qty: number; total: number };

export default function MenuReportPage() {
  const today = todayBKK();
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [sort, setSort] = useState<"qty" | "total">("qty");

  const { data, isLoading } = useSWR<{ items: MenuItem[] }>(
    `/api/analytics/menu?from=${from}&to=${to}`,
    fetcher,
  );

  const sorted = [...(data?.items ?? [])].sort((a, b) => b[sort] - a[sort]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/analytics" className="text-gray-400 hover:text-navy text-sm">← กลับ</Link>
        <h1 className="text-xl font-bold text-navy">เมนูขายดี</h1>
      </div>

      <div className="mb-4">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sand text-xs text-gray-400">
              <th className="text-left p-3 pl-4 w-8">#</th>
              <th className="text-left p-3">เมนู</th>
              <th
                className={`text-right p-3 cursor-pointer select-none ${sort === "qty" ? "text-orange font-bold" : "hover:text-navy"}`}
                onClick={() => setSort("qty")}
              >
                จำนวน {sort === "qty" && "↓"}
              </th>
              <th
                className={`text-right p-3 pr-4 cursor-pointer select-none ${sort === "total" ? "text-orange font-bold" : "hover:text-navy"}`}
                onClick={() => setSort("total")}
              >
                ยอด (฿) {sort === "total" && "↓"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand/50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={4} className="p-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
              ))
            ) : sorted.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-gray-400 py-10">ไม่มีข้อมูลในช่วงนี้</td></tr>
            ) : (
              sorted.map((item, idx) => (
                <tr key={item.menuItemId} className="hover:bg-sand/20">
                  <td className="p-3 pl-4 text-lg">{RANKS[idx] ?? <span className="text-gray-400 text-xs font-semibold">{idx + 1}</span>}</td>
                  <td className="p-3 font-medium text-navy">{item.nameTh}</td>
                  <td className="p-3 text-right text-gray-600">{item.qty.toLocaleString()}</td>
                  <td className="p-3 pr-4 text-right font-semibold text-navy">฿{item.total.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
