"use client";

import { useState } from "react";
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
  staffNote: string | null;
  createdAt: string;
  order: {
    id: number;
    orderName: string;
    items: { quantity: number; unitPriceTHB: number; menuItem: { nameTh: string } }[];
  };
}

function parsePendingPlayers(staffNote: string | null): { packageType: string; drinkName?: string; qty?: number }[] {
  if (!staffNote) return [];
  try { return JSON.parse(staffNote).players ?? []; } catch { return []; }
}

const PKG_LABELS: Record<string, string> = {
  A: "Package A (ฟรี+เครื่องดื่ม)",
  B: "Package B (49฿/2ชม.)",
  C: "Package C (120฿ เหมาวัน)",
  D: "Package D (80฿ อัพเกรด)",
};

export default function AdminPaymentPage() {
  const { data: payments, mutate } = useSWR<PendingPayment[]>(
    "/api/payment",
    fetcher,
    { refreshInterval: 8000 }
  );

  const [cashModal, setCashModal] = useState<PendingPayment | null>(null);
  const [cashInputStr, setCashInputStr] = useState("");

  async function confirm(paymentId: number, receivedAmount?: number) {
    const changeAmount = receivedAmount != null
      ? Math.max(0, receivedAmount - (cashModal?.amountTHB ?? 0))
      : undefined;
    await fetch("/api/payment/confirm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, receivedAmount, changeAmount }),
    });
    mutate();
    setCashModal(null);
  }

  function openCashModal(p: PendingPayment) {
    setCashModal(p);
    setCashInputStr("");
  }

  // Sort: PromptPay with slip first (ready to verify), then without slip
  const promptpay = (payments?.filter((p) => p.method === "PROMPTPAY") ?? [])
    .sort((a, b) => (b.slipUrl ? 1 : 0) - (a.slipUrl ? 1 : 0));
  const counter = payments?.filter((p) => p.method !== "PROMPTPAY") ?? [];

  const cashReceived = parseInt(cashInputStr.replace(/,/g, ""), 10) || 0;
  const cashChange = cashModal ? cashReceived - cashModal.amountTHB : 0;

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
          {/* PromptPay — with slip shown first */}
          {promptpay.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">📷 QR PromptPay</span>
                <span className="text-gray-400 font-normal">{promptpay.length} รายการ</span>
              </h2>
              <div className="space-y-4">
                {promptpay.map((p) => (
                  <div key={p.id} className={`bg-white rounded-2xl p-4 shadow-sm ${p.slipUrl ? "ring-2 ring-green-200" : ""}`}>
                    {p.slipUrl && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs text-green-600 font-semibold">ลูกค้าส่งสลิปแล้ว — รอตรวจสอบ</span>
                      </div>
                    )}
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

          {/* Counter cash payment */}
          {counter.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-navy mb-3 flex items-center gap-2">
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">💵 เคาน์เตอร์</span>
                <span className="text-gray-400 font-normal">{counter.length} รายการ</span>
              </h2>
              <div className="space-y-4">
                {counter.map((p) => {
                  const pendingPlayers = parsePendingPlayers(p.staffNote);
                  return (
                    <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-navy text-base">{p.order.orderName}</p>
                          <p className="text-xs text-gray-400">{formatThaiDateTime(p.createdAt)}</p>
                        </div>
                        <p className="text-2xl font-bold text-orange">฿{p.amountTHB}</p>
                      </div>
                      {pendingPlayers.length > 0 ? (
                        <div className="mb-3 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 space-y-1">
                          <p className="text-xs font-bold text-blue-700 mb-1">ผู้เล่น {pendingPlayers.length} คน</p>
                          {pendingPlayers.map((pl, i) => (
                            <p key={i} className="text-xs text-blue-800">
                              {i + 1}. {PKG_LABELS[pl.packageType] ?? pl.packageType}
                              {pl.drinkName ? ` — ${pl.drinkName}` : ""}
                              {pl.qty && pl.qty > 1 ? ` ×${pl.qty}` : ""}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-0.5 mb-3 text-sm text-gray-600">
                          {p.order.items.map((item, i) => (
                            <p key={i}>{item.menuItem.nameTh} ×{item.quantity}</p>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => openCashModal(p)}
                        className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-sm"
                      >
                        💵 รับเงินสด ฿{p.amountTHB}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/admin" className="text-sm text-gray-400 hover:text-navy">← กลับหน้า Dashboard</Link>
      </div>

      {/* Cash amount modal */}
      {cashModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-4">
            <h3 className="font-bold text-navy text-lg text-center">รับเงินสด</h3>
            <p className="text-sm text-center text-gray-500">{cashModal.order.orderName}</p>
            <div className="text-center">
              <p className="text-xs text-gray-400">ยอดที่ต้องชำระ</p>
              <p className="text-3xl font-bold text-orange">฿{cashModal.amountTHB.toLocaleString()}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-navy block mb-1">ลูกค้าจ่ายมา</label>
              <input
                type="number"
                inputMode="numeric"
                autoFocus
                value={cashInputStr}
                onChange={(e) => setCashInputStr(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && cashReceived >= cashModal.amountTHB) {
                    confirm(cashModal.id, cashReceived);
                  }
                }}
                placeholder="0"
                className="w-full border-2 border-sand rounded-xl px-4 py-3 text-2xl font-bold text-navy text-center focus:outline-none focus:border-orange"
              />
            </div>
            {cashInputStr && (
              <div className={`rounded-xl p-3 text-center ${cashReceived >= cashModal.amountTHB ? "bg-green-50" : "bg-red-50"}`}>
                {cashReceived >= cashModal.amountTHB ? (
                  <>
                    <p className="text-xs text-green-600">เงินทอน</p>
                    <p className="text-3xl font-bold text-green-700">฿{cashChange.toLocaleString()}</p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-red-500">
                    ยอดไม่เพียงพอ — ขาดอีก ฿{(cashModal.amountTHB - cashReceived).toLocaleString()}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {[20, 50, 100, 500, 1000].map((amt) => (
                <button key={amt} type="button"
                  onClick={() => setCashInputStr(String((parseInt(cashInputStr) || 0) + amt))}
                  className="bg-sand/50 hover:bg-orange/10 border border-sand text-navy text-sm font-semibold py-2 rounded-xl">
                  +{amt}
                </button>
              ))}
              <button type="button" onClick={() => setCashInputStr("")}
                className="bg-sand/50 border border-sand text-gray-400 text-sm py-2 rounded-xl">ล้าง</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCashModal(null)}
                className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm font-semibold">ยกเลิก</button>
              <button
                onClick={() => confirm(cashModal.id, cashReceived)}
                disabled={!cashInputStr || cashReceived < cashModal.amountTHB}
                className="flex-1 bg-green-600 text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40">
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
