"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle, QrCode, Banknote, Loader2 } from "lucide-react";

type Step = "select" | "promptpay" | "counter" | "done";

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = use(params);
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [step, setStep] = useState<Step>("select");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [amountTHB, setAmountTHB] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) setStep("done");
  }, [orderId]);

  async function selectPromptPay() {
    setLoading(true);
    const res = await fetch("/api/payment/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    setQrDataUrl(data.qrDataUrl);
    setAmountTHB(data.amountTHB);
    setStep("promptpay");
    setLoading(false);
  }

  async function selectCounter() {
    await fetch("/api/payment/counter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    setStep("counter");
  }

  if (step === "select") {
    return (
      <main className="min-h-screen bg-cream flex flex-col p-6">
        <div className="mb-6">
          <p className="text-sm text-gray-400">โต๊ะ {tableId}</p>
          <h1 className="text-2xl font-bold text-navy">เลือกวิธีชำระเงิน</h1>
        </div>

        <div className="space-y-3">
          <button
            onClick={selectPromptPay}
            disabled={loading}
            className="w-full bg-white rounded-2xl p-5 text-left shadow-sm border-2 border-transparent hover:border-orange active:scale-[0.98] transition-all flex items-center gap-4"
          >
            <div className="bg-orange/10 rounded-xl p-3">
              <QrCode size={28} className="text-orange" />
            </div>
            <div>
              <p className="font-bold text-navy text-base">จ่ายผ่าน QR พร้อมเพย์</p>
              <p className="text-xs text-gray-400 mt-0.5">สแกนจ่ายทันที พนักงานยืนยันรับเงิน</p>
            </div>
            {loading && <Loader2 size={18} className="ml-auto text-orange animate-spin" />}
          </button>

          <button
            onClick={selectCounter}
            className="w-full bg-white rounded-2xl p-5 text-left shadow-sm border-2 border-transparent hover:border-navy active:scale-[0.98] transition-all flex items-center gap-4"
          >
            <div className="bg-navy/10 rounded-xl p-3">
              <Banknote size={28} className="text-navy" />
            </div>
            <div>
              <p className="font-bold text-navy text-base">ชำระที่เคาน์เตอร์</p>
              <p className="text-xs text-gray-400 mt-0.5">เงินสด / บัตรเครดิต / เดบิต</p>
            </div>
          </button>
        </div>

        <Link href={`/table/${tableId}`} className="mt-6 text-center text-sm text-gray-400 underline">
          ← กลับไปสั่งอาหารเพิ่ม
        </Link>
      </main>
    );
  }

  if (step === "promptpay") {
    return (
      <main className="min-h-screen bg-cream flex flex-col items-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-bold text-navy mb-1">สแกนจ่ายพร้อมเพย์</h1>
          <p className="text-sm text-gray-400 mb-6">แสดง QR Code นี้ให้พนักงานดูหลังโอนเงิน</p>

          <div className="bg-white rounded-2xl p-6 shadow-sm text-center mb-4">
            {qrDataUrl && (
              <Image src={qrDataUrl} alt="PromptPay QR" width={260} height={260} className="mx-auto" />
            )}
            <p className="text-3xl font-bold text-navy mt-4">฿{amountTHB.toLocaleString("th-TH")}</p>
            <p className="text-xs text-gray-400 mt-1">Dice Shop ร้านลูกเต๋า</p>
          </div>

          <div className="bg-sand rounded-xl p-4 text-sm text-gray-600 space-y-1">
            <p>1. สแกน QR Code ด้วยแอปธนาคาร</p>
            <p>2. ยืนยันยอด <span className="font-bold text-navy">฿{amountTHB}</span></p>
            <p>3. รอพนักงานกดยืนยันรับเงิน</p>
          </div>

          <button
            onClick={() => setStep("done")}
            className="w-full mt-4 bg-navy text-cream font-bold py-3 rounded-xl"
          >
            โอนเงินแล้ว แจ้งพนักงาน
          </button>
        </div>
      </main>
    );
  }

  if (step === "counter") {
    return (
      <main className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-4">🏪</div>
          <h1 className="text-2xl font-bold text-navy mb-2">กรุณาชำระที่เคาน์เตอร์</h1>
          <p className="text-gray-500 mb-6">บอกพนักงานว่ามาจาก <span className="font-bold text-navy">โต๊ะ {tableId}</span></p>
          <div className="bg-navy text-cream rounded-2xl p-5 mb-6">
            <p className="text-sm opacity-70">โต๊ะที่</p>
            <p className="text-5xl font-bold">{tableId}</p>
          </div>
          <p className="text-xs text-gray-400">รับชำระ เงินสด · บัตรเครดิต · บัตรเดบิต</p>
        </div>
      </main>
    );
  }

  // done
  return (
    <main className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <CheckCircle size={64} className="text-sage mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-navy mb-2">ขอบคุณที่ใช้บริการ!</h1>
        <p className="text-gray-400 mb-8 text-sm">ยินดีต้อนรับกลับมาอีกครั้ง 🎲</p>
        <Link href="/" className="block w-full bg-orange text-white font-bold py-3 rounded-xl">
          กลับหน้าหลัก
        </Link>
      </div>
    </main>
  );
}
