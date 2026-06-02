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
function formatBKK(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function receiptNumber(id: number, confirmedAt: string) {
  const d = new Date(confirmedAt).toISOString().slice(0, 10).replace(/-/g, "");
  return `RC-${d}-${String(id).padStart(5, "0")}`;
}

const METHOD_LABELS: Record<string, string> = {
  PROMPTPAY: "QR PromptPay",
  CASH: "เงินสด",
  TAB: "แท็บ",
  UNSET: "-",
};
const METHOD_COLORS: Record<string, string> = {
  PROMPTPAY: "bg-blue-100 text-blue-700",
  CASH: "bg-green-100 text-green-700",
  TAB: "bg-purple-100 text-purple-700",
  UNSET: "bg-gray-100 text-gray-500",
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Receipt = {
  id: number;
  orderId: number;
  orderName: string;
  totalTHB: number;
  paymentMethod: string;
  locationLabel: string;
  confirmedAt: string;
};

type ReceiptsData = {
  receipts: Receipt[];
  total: number;
  page: number;
  totalPages: number;
};

export default function ReceiptsPage() {
  const today = todayBKK();
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ from, to, page: String(page) });
  const { data, isLoading } = useSWR<ReceiptsData>(
    `/api/receipts?${params}`,
    fetcher
  );

  const totalAmount = data?.receipts.reduce((s, r) => s + r.totalTHB, 0) ?? 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/analytics" className="text-gray-400 hover:text-navy text-sm">← กลับ</Link>
        <h1 className="text-xl font-bold text-navy">ใบเสร็จดิจิตอล</h1>
      </div>

      <div className="mb-4">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
      </div>

      {data && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400">
            พบ {data.total.toLocaleString()} ใบเสร็จ (หน้า {data.page}/{data.totalPages})
          </p>
          {data.receipts.length > 0 && (
            <p className="text-xs font-semibold text-navy">
              รวม ฿{totalAmount.toLocaleString()}
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm divide-y divide-sand/50">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))
        ) : !data?.receipts.length ? (
          <p className="text-center text-gray-400 py-10">ไม่มีใบเสร็จในช่วงนี้</p>
        ) : (
          data.receipts.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-navy text-sm">{receiptNumber(r.id, r.confirmedAt)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${METHOD_COLORS[r.paymentMethod] ?? "bg-gray-100 text-gray-500"}`}>
                    {METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                  <span>{formatBKK(r.confirmedAt)}</span>
                  {r.orderName && <><span>·</span><span className="truncate max-w-[120px]">{r.orderName}</span></>}
                  {r.locationLabel && r.locationLabel !== "-" && (
                    <><span>·</span><span>{r.locationLabel}</span></>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p className="font-bold text-navy text-sm">฿{r.totalTHB.toLocaleString()}</p>
                <a
                  href={`/api/receipts/${r.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 bg-navy text-white rounded-xl font-semibold hover:bg-navy/80 transition-colors"
                >
                  ดู / PDF
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-3 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm rounded-xl border border-sand disabled:opacity-40 hover:border-orange"
          >
            ก่อนหน้า
          </button>
          <span className="px-4 py-2 text-sm text-gray-500">{page} / {data.totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="px-4 py-2 text-sm rounded-xl border border-sand disabled:opacity-40 hover:border-orange"
          >
            ถัดไป
          </button>
        </div>
      )}
    </div>
  );
}
