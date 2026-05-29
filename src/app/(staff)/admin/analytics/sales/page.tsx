"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import DateRangePicker from "@/components/admin/DateRangePicker";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

function todayBKK() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
function addDays(d: string, n: number) {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SalesData = {
  totalSales: number;
  totalBills: number;
  avgBasket: number;
  voidAmount: number;
  pctChange: number | null;
  chart: { date: string; revenue: number; count: number }[];
};

export default function SalesReportPage() {
  const today = todayBKK();
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);

  const { data, isLoading } = useSWR<SalesData>(
    `/api/analytics/sales?from=${from}&to=${to}`,
    fetcher,
  );

  const cards = data
    ? [
        { label: "ยอดรวม", value: `฿${data.totalSales.toLocaleString()}`, icon: "💰", sub: null },
        { label: "จำนวนบิล", value: `${data.totalBills}`, icon: "🧾", sub: "บิล" },
        { label: "เฉลี่ย/บิล", value: `฿${data.avgBasket.toLocaleString()}`, icon: "📊", sub: null },
        { label: "ออเดอร์ยกเลิก", value: `฿${data.voidAmount.toLocaleString()}`, icon: "🚫", sub: null },
        {
          label: "เทียบช่วงก่อน",
          value: data.pctChange === null ? "—" : `${data.pctChange > 0 ? "+" : ""}${data.pctChange}%`,
          icon: data.pctChange !== null && data.pctChange >= 0 ? "▲" : "▼",
          sub: null,
          positive: data.pctChange !== null && data.pctChange >= 0,
          hasChange: data.pctChange !== null,
        },
      ]
    : [];

  const chartData = data?.chart.map((d) => ({
    ...d,
    label: d.date.slice(5),
  })) ?? [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/analytics" className="text-gray-400 hover:text-navy text-sm">← กลับ</Link>
        <h1 className="text-xl font-bold text-navy">สรุปยอดขาย</h1>
      </div>

      <div className="mb-4">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {cards.slice(0, 4).map((c) => (
              <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className="text-xl font-bold text-navy">{c.value}</p>
              </div>
            ))}
          </div>
          {cards[4] && (
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 flex items-center gap-3">
              <p className="text-xs text-gray-400 flex-1">{cards[4].label}</p>
              <p className={`text-xl font-bold ${
                !cards[4].hasChange ? "text-gray-400" :
                cards[4].positive ? "text-green-600" : "text-red-500"
              }`}>{cards[4].value}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-sm font-bold text-navy mb-3">รายได้รายวัน</p>
            {chartData.length === 0 || chartData.every((d) => d.revenue === 0) ? (
              <p className="text-center text-gray-400 text-sm py-10">ไม่มีข้อมูลในช่วงนี้</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <Tooltip
                    formatter={(v) => [`฿${Number(v).toLocaleString()}`, "รายได้"]}
                    labelFormatter={(l) => `วันที่ ${l}`}
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: "#f97316" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}
