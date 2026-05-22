"use client";

import { useState } from "react";
import useSWR from "swr";
import Image from "next/image";

interface PaymentConfig {
  id: number;
  qrImageUrl: string | null;
  accountName: string;
  bankName: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminSettingsPage() {
  const { data: config, mutate } = useSWR<PaymentConfig>("/api/payment-config", fetcher);
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync local state when config loads
  if (config && accountName === "" && config.accountName) {
    setAccountName(config.accountName);
    setBankName(config.bankName);
  }

  function handleQrFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setQrFile(f);
    setQrPreview(URL.createObjectURL(f));
  }

  async function save() {
    setSaving(true);
    setSuccess(false);
    try {
      let qrImageUrl: string | undefined;

      if (qrFile) {
        const fd = new FormData();
        fd.append("file", qrFile);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const d = await res.json();
          alert(d.error ?? "อัปโหลดรูป QR ไม่ได้");
          return;
        }
        const d = await res.json();
        qrImageUrl = d.url;
      }

      await fetch("/api/payment-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountName, bankName, ...(qrImageUrl ? { qrImageUrl } : {}) }),
      });
      await mutate();
      setQrFile(null);
      setQrPreview(null);
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  const currentQr = qrPreview ?? config?.qrImageUrl;

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-navy mb-6">ตั้งค่าการชำระเงิน</h1>

      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-5">

        {/* QR Image */}
        <div>
          <label className="text-sm font-semibold text-navy block mb-2">รูป QR Code</label>
          <div className="flex items-start gap-4">
            <div className="w-32 h-32 rounded-xl border-2 border-sand flex items-center justify-center overflow-hidden shrink-0 bg-sand/30">
              {currentQr ? (
                <div className="relative w-full h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentQr} alt="QR" className="w-full h-full object-contain" />
                </div>
              ) : (
                <span className="text-3xl">📷</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400 mb-2">รูปนี้จะแสดงให้ลูกค้าสแกนในหน้าชำระเงิน</p>
              <label className="cursor-pointer bg-orange/10 text-orange font-semibold text-sm px-3 py-2 rounded-xl hover:bg-orange/20 transition-colors inline-block">
                {currentQr ? "เปลี่ยนรูป QR" : "อัปโหลดรูป QR"}
                <input type="file" accept="image/*" className="hidden" onChange={handleQrFile} />
              </label>
              {qrFile && (
                <p className="text-xs text-gray-400 mt-1">เลือก: {qrFile.name}</p>
              )}
            </div>
          </div>
        </div>

        {/* Account Name */}
        <div>
          <label className="text-sm font-semibold text-navy block mb-1">ชื่อบัญชี</label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none"
            placeholder="เช่น นาย ธนวุฒิ พุ่มมาก"
          />
        </div>

        {/* Bank/Payment Name */}
        <div>
          <label className="text-sm font-semibold text-navy block mb-1">ธนาคาร / ช่องทาง</label>
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none"
            placeholder="เช่น TTB PromptPay"
          />
        </div>

        {/* Preview */}
        {(accountName || bankName || currentQr) && (
          <div className="bg-sand/30 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2">ตัวอย่างที่ลูกค้าจะเห็น</p>
            <div className="flex items-center gap-3">
              {currentQr && (
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-sand shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentQr} alt="QR preview" className="w-full h-full object-contain" />
                </div>
              )}
              <div>
                <p className="font-bold text-navy text-sm">{accountName || "—"}</p>
                <p className="text-xs text-gray-400">{bankName || "—"}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <p className="text-sm text-green-600 font-medium">✅ บันทึกเรียบร้อยแล้ว</p>
        )}

        <button
          onClick={save}
          disabled={saving || !accountName.trim()}
          className="w-full bg-orange text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </button>
      </div>
    </div>
  );
}
