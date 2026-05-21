"use client";

import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";
import { formatThaiDateTime } from "@/lib/thai-datetime";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface PendingPayment {
  id: number;
  amountTHB: number;
  createdAt: string;
  order: {
    id: number;
    table: { number: number };
    items: { quantity: number; unitPriceTHB: number; menuItem: { nameTh: string } }[];
  };
}

export default function AdminPaymentPage() {
  const { data: payments, mutate } = useSWR<PendingPayment[]>(
    "/api/payment",
    fetcher,
    { refreshInterval: 8000 }
  );

  async function confirm(paymentId: number) {
    await fetch("/api/payment/confirm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    });
    mutate();
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="bg-navy px-4 pt-4 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/DS-new-logo.png" alt="Dice Shop" width={40} height={22} className="object-contain brightness-0 invert" />
            <div>
              <p className="text-cream/70 text-xs">หน้าจอพนักงาน</p>
              <h1 className="text-cream font-bold text-lg leading-tight">ยืนยันการชำระเงิน</h1>
            </div>
          </div>
          <Link href="/admin" className="text-cream/60 text-xs underline">← ออเดอร์</Link>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-navy">รอยืนยันพร้อมเพย์</h2>
          <span className="text-xs text-gray-400">รีเฟรชทุก 8 วิ</span>
        </div>

        {!payments ? (
          <p className="text-center py-8 text-gray-400">กำลังโหลด...</p>
        ) : payments.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">✅</p>
            <p>ไม่มีรายการรอยืนยัน</p>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((p) => (
              <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex justify-between mb-2">
                  <div>
                    <p className="font-bold text-navy text-lg">โต๊ะ {p.order.table.number}</p>
                    <p className="text-xs text-gray-400">{formatThaiDateTime(p.createdAt)}</p>
                  </div>
                  <p className="text-2xl font-bold text-orange">฿{p.amountTHB}</p>
                </div>

                <div className="space-y-0.5 mb-3 text-sm text-gray-600">
                  {p.order.items.map((item, i) => (
                    <p key={i}>{item.menuItem.nameTh} x{item.quantity}</p>
                  ))}
                </div>

                <button
                  onClick={() => confirm(p.id)}
                  className="w-full bg-sage text-white font-bold py-3 rounded-xl text-base"
                >
                  ✅ ยืนยันได้รับเงินแล้ว ฿{p.amountTHB}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
