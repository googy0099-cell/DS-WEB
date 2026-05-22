"use client";

import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";
import { formatThaiDateTime } from "@/lib/thai-datetime";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface PendingPayment {
  id: number;
  method: string;
  amountTHB: number;
  slipUrl: string | null;
  createdAt: string;
  order: {
    id: number;
    orderName: string;
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

  const promptpay = payments?.filter((p) => p.method === "PROMPTPAY") ?? [];
  const counter = payments?.filter((p) => p.method !== "PROMPTPAY") ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-navy">ยืนยันการชำระเงิน</h1>
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
        <div className="space-y-6">
          {/* PromptPay with slip */}
          {promptpay.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">📷 QR PromptPay</span>
                <span className="text-gray-400 font-normal">{promptpay.length} รายการ</span>
              </h2>
              <div className="space-y-4">
                {promptpay.map((p) => (
                  <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-navy text-base">{p.order.orderName}</p>
                        <p className="text-xs text-gray-400">{formatThaiDateTime(p.createdAt)}</p>
                      </div>
                      <p className="text-2xl font-bold text-orange">฿{p.amountTHB}</p>
                    </div>

                    <div className="space-y-0.5 mb-3 text-sm text-gray-600">
                      {p.order.items.map((item, i) => (
                        <p key={i}>{item.menuItem.nameTh} ×{item.quantity}</p>
                      ))}
                    </div>

                    {p.slipUrl ? (
                      <div className="mb-3">
                        <p className="text-xs text-gray-400 mb-1">สลิปจากลูกค้า</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.slipUrl}
                          alt="slip"
                          className="w-full max-h-56 object-contain rounded-xl border border-sand cursor-pointer"
                          onClick={() => window.open(p.slipUrl!, "_blank")}
                        />
                      </div>
                    ) : (
                      <div className="mb-3 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 text-xs text-yellow-700">
                        ยังไม่มีสลิป — รอลูกค้าส่ง
                      </div>
                    )}

                    <button
                      onClick={() => confirm(p.id)}
                      className="w-full bg-sage text-white font-bold py-3 rounded-xl text-sm"
                    >
                      ✅ ยืนยันได้รับเงินแล้ว ฿{p.amountTHB}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Counter payment */}
          {counter.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">💵 เคาน์เตอร์</span>
                <span className="text-gray-400 font-normal">{counter.length} รายการ</span>
              </h2>
              <div className="space-y-4">
                {counter.map((p) => (
                  <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-navy text-base">{p.order.orderName}</p>
                        <p className="text-xs text-gray-400">{formatThaiDateTime(p.createdAt)}</p>
                      </div>
                      <p className="text-2xl font-bold text-orange">฿{p.amountTHB}</p>
                    </div>
                    <div className="space-y-0.5 mb-3 text-sm text-gray-600">
                      {p.order.items.map((item, i) => (
                        <p key={i}>{item.menuItem.nameTh} ×{item.quantity}</p>
                      ))}
                    </div>
                    <button
                      onClick={() => confirm(p.id)}
                      className="w-full bg-navy text-cream font-bold py-3 rounded-xl text-sm"
                    >
                      ✅ ยืนยันรับเงินสด ฿{p.amountTHB}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/admin" className="text-sm text-gray-400 hover:text-navy">← กลับหน้า Dashboard</Link>
      </div>
    </div>
  );
}
