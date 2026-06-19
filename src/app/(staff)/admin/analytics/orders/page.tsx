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
  const bkk = new Date(new Date(iso).getTime() + 7 * 3600_000);
  const d = bkk.toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)} ${d.slice(11, 16)}`;
}

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error("fetch failed");
  return r.json();
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "รอดำเนินการ",
  PREPARING: "กำลังทำ",
  SERVED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PREPARING: "bg-blue-100 text-blue-700",
  SERVED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-500",
};

type Order = {
  id: number;
  orderName: string | null;
  status: string;
  totalTHB: number;
  discountAmount: number | null;
  createdAt: string;
  billId: number | null;
  payment: { method: string } | null;
  _count: { items: number };
};

type OrdersData = {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export default function OrderHistoryPage() {
  const today = todayBKK();
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ from, to, page: String(page) });
  if (status) params.set("status", status);
  if (type) params.set("type", type);

  const { data, isLoading } = useSWR<OrdersData>(
    `/api/analytics/orders?${params}`,
    fetcher,
  );

  function handleFilter() {
    setPage(1);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/analytics" className="text-gray-400 hover:text-navy text-sm">← กลับ</Link>
        <h1 className="text-xl font-bold text-navy">ประวัติออเดอร์</h1>
      </div>

      <div className="space-y-3 mb-4">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setPage(1); }} />
        <div className="flex gap-2">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); handleFilter(); }}
            className="flex-1 border border-sand rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-orange text-navy"
          >
            <option value="">ทุกสถานะ</option>
            <option value="SERVED">เสร็จสิ้น</option>
            <option value="CANCELLED">ยกเลิก</option>
            <option value="PENDING">รอดำเนินการ</option>
            <option value="PREPARING">กำลังทำ</option>
          </select>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); handleFilter(); }}
            className="flex-1 border border-sand rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-orange text-navy"
          >
            <option value="">ทุกประเภท</option>
            <option value="dine-in">Dine-in</option>
            <option value="online">Online</option>
          </select>
        </div>
      </div>

      {data && (
        <p className="text-xs text-gray-400 mb-2">
          พบ {data.total.toLocaleString()} รายการ (หน้า {data.page}/{data.totalPages})
        </p>
      )}

      <div className="bg-white rounded-2xl shadow-sm divide-y divide-sand/50">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))
        ) : !data?.orders.length ? (
          <p className="text-center text-gray-400 py-10">ไม่มีข้อมูลในช่วงนี้</p>
        ) : (
          data.orders.map((o) => (
            <div key={o.id} className="flex items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-navy text-sm">#{o.id}</p>
                  {o.orderName && <p className="text-xs text-gray-400 truncate">{o.orderName}</p>}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{formatBKK(o.createdAt)}</span>
                  <span>·</span>
                  <span>{o.billId ? "Dine-in" : "Online"}</span>
                  <span>·</span>
                  <span>{o._count.items} รายการ</span>
                  {o.payment && <><span>·</span><span>{o.payment.method}</span></>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-navy text-sm">฿{(o.totalTHB - (o.discountAmount ?? 0)).toLocaleString()}</p>
                {(o.discountAmount ?? 0) > 0 && <p className="text-[10px] text-green-600">−฿{(o.discountAmount ?? 0).toLocaleString()} ส่วนลด</p>}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {STATUS_LABELS[o.status] ?? o.status}
                </span>
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
