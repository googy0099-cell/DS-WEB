"use client";

import { useState, useRef, useEffect } from "react";

interface PaymentConfig {
  qrImageUrl: string | null;
  accountName: string;
  bankName: string;
}

interface Props {
  orderId: number;
  totalTHB: number;
  orderName: string;
}

type Step = "select" | "qr" | "counter" | "done";

export default function PaymentSection({ orderId, totalTHB, orderName }: Props) {
  const [step, setStep] = useState<Step>("select");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/payment-config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSlipFile(f);
    setSlipPreview(URL.createObjectURL(f));
    setError("");
  }

  async function selectCounter() {
    try {
      await fetch("/api/payment/counter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
    } catch {}
    setStep("counter");
  }

  async function submitSlip() {
    if (!slipFile) { setError("กรุณาเลือกรูปสลิปก่อน"); return; }
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("orderId", String(orderId));
      fd.append("slip", slipFile);
      const res = await fetch("/api/payment/slip", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "เกิดข้อผิดพลาด");
      }
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setUploading(false);
    }
  }

  if (step === "select") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-navy text-center mb-1">เลือกวิธีชำระเงิน</p>
        <button
          onClick={() => setStep("qr")}
          className="w-full flex items-center gap-4 bg-blue-50 border-2 border-blue-200 hover:border-blue-400 rounded-2xl p-4 transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl shrink-0">
            📷
          </div>
          <div>
            <p className="font-bold text-navy">สแกน QR PromptPay</p>
            <p className="text-xs text-gray-400">สแกนจ่ายแล้วส่งสลิปยืนยัน</p>
          </div>
        </button>
        <button
          onClick={selectCounter}
          className="w-full flex items-center gap-4 bg-gray-50 border-2 border-gray-200 hover:border-gray-400 rounded-2xl p-4 transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl shrink-0">
            💵
          </div>
          <div>
            <p className="font-bold text-navy">ชำระที่เคาน์เตอร์</p>
            <p className="text-xs text-gray-400">จ่ายเงินสดหรือบัตรที่เคาน์เตอร์</p>
          </div>
        </button>
      </div>
    );
  }

  if (step === "qr") {
    return (
      <div>
        <button onClick={() => setStep("select")} className="text-xs text-gray-400 hover:text-navy mb-3">
          ← เปลี่ยนวิธีชำระ
        </button>

        <div className="text-center mb-4">
          <p className="text-sm text-gray-500 mb-1">สแกนเพื่อชำระ</p>
          <p className="text-2xl font-bold text-orange mb-4">฿{totalTHB}</p>
          {(config?.qrImageUrl ?? "/promptpay-qr.png") && (
            <div className="w-56 h-56 mx-auto rounded-2xl overflow-hidden shadow-md bg-white flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config?.qrImageUrl ?? "/promptpay-qr.png"}
                alt="PromptPay QR"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <p className="text-sm font-semibold text-navy mt-3">
            {config?.accountName ?? "นาย ธนวุฒิ พุ่มมาก"}
          </p>
          <p className="text-xs text-gray-400">{config?.bankName ?? "TTB PromptPay"}</p>
        </div>

        <div className="border-t border-sand pt-4">
          <p className="text-sm font-semibold text-navy mb-2">อัปโหลดสลิปเพื่อยืนยัน</p>

          {slipPreview ? (
            <div className="relative mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slipPreview} alt="slip" className="w-full max-h-48 object-contain rounded-xl border border-sand" />
              <button
                onClick={() => { setSlipFile(null); setSlipPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="absolute top-2 right-2 bg-white/80 rounded-full px-2 py-0.5 text-xs text-red-500 font-semibold"
              >
                เปลี่ยน
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-sand hover:border-orange rounded-xl py-6 text-center text-sm text-gray-400 hover:text-orange transition-colors mb-3"
            >
              แตะเพื่อเลือกรูปสลิป
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

          <button
            onClick={submitSlip}
            disabled={uploading || !slipFile}
            className="w-full bg-orange text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-opacity"
          >
            {uploading ? "กำลังส่ง..." : "ส่งสลิปยืนยัน"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "counter") {
    return (
      <div className="text-center py-2">
        <div className="text-5xl mb-3">💵</div>
        <p className="font-bold text-navy text-lg mb-1">กรุณาชำระที่เคาน์เตอร์</p>
        <p className="text-gray-400 text-sm mb-3">แจ้งชื่อ <span className="font-semibold text-navy">{orderName}</span> กับพนักงาน</p>
        <p className="text-3xl font-bold text-orange">฿{totalTHB}</p>
      </div>
    );
  }

  return (
    <div className="text-center py-2">
      <div className="text-5xl mb-3">✅</div>
      <p className="font-bold text-navy text-lg mb-1">ส่งสลิปเรียบร้อย!</p>
      <p className="text-gray-400 text-sm">ทางร้านจะตรวจสอบและยืนยันเร็ว ๆ นี้</p>
    </div>
  );
}
