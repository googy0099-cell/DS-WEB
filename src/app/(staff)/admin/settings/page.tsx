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

interface SiteSettings {
  promo_title?: string;
  promo_body?: string;
  promo_enabled?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminSettingsPage() {
  const { data: config, mutate } = useSWR<PaymentConfig>("/api/payment-config", fetcher);
  const { data: siteSettings, mutate: mutateSite } = useSWR<SiteSettings>("/api/site-settings", fetcher);

  const [promoTitle, setPromoTitle] = useState("");
  const [promoBody, setPromoBody] = useState("");
  const [promoEnabled, setPromoEnabled] = useState(true);
  const [promoLoaded, setPromoLoaded] = useState(false);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoSuccess, setPromoSuccess] = useState(false);

  if (siteSettings && !promoLoaded) {
    setPromoTitle(siteSettings.promo_title ?? "🎉 โปรโมชั่นพิเศษ!");
    setPromoBody(siteSettings.promo_body ?? "สั่งครบ ฿300 รับเครื่องดื่มฟรี 1 แก้ว (ทุกวัน 15:00 – 17:00)");
    setPromoEnabled(siteSettings.promo_enabled !== "false");
    setPromoLoaded(true);
  }

  async function savePromo() {
    setPromoSaving(true);
    setPromoSuccess(false);
    try {
      await fetch("/api/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promo_title: promoTitle,
          promo_body: promoBody,
          promo_enabled: promoEnabled ? "true" : "false",
        }),
      });
      await mutateSite();
      setPromoSuccess(true);
    } finally {
      setPromoSaving(false);
    }
  }
  const [promptPayId, setPromptPayId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync local state when config loads
  if (config && accountName === "" && config.accountName) {
    setPromptPayId((config as { promptPayId?: string }).promptPayId ?? "");
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
        body: JSON.stringify({ promptPayId: promptPayId.trim() || null, accountName, bankName, ...(qrImageUrl ? { qrImageUrl } : {}) }),
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
    <div className="max-w-lg space-y-8">

      {/* Promo Banner */}
      <div>
        <h1 className="text-xl font-bold text-navy mb-4">โปรโมชั่นหน้าเว็บ</h1>
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-navy">แสดงแบนเนอร์โปรโมชั่น</label>
            <button
              onClick={() => setPromoEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${promoEnabled ? "bg-orange" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${promoEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div>
            <label className="text-sm font-semibold text-navy block mb-1">หัวข้อ</label>
            <input
              type="text"
              value={promoTitle}
              onChange={(e) => setPromoTitle(e.target.value)}
              className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none"
              placeholder="เช่น 🎉 โปรโมชั่นพิเศษ!"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-navy block mb-1">รายละเอียด</label>
            <textarea
              value={promoBody}
              onChange={(e) => setPromoBody(e.target.value)}
              rows={2}
              className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none resize-none"
              placeholder="เช่น สั่งครบ ฿300 รับเครื่องดื่มฟรี 1 แก้ว (ทุกวัน 15:00 – 17:00)"
            />
          </div>

          {/* Preview */}
          {promoEnabled && (promoTitle || promoBody) && (
            <div className="relative overflow-hidden bg-orange rounded-2xl p-4 text-white">
              <p className="font-bold text-base">{promoTitle || "หัวข้อโปรโมชั่น"}</p>
              <p className="text-white/80 text-sm">{promoBody || "รายละเอียด"}</p>
            </div>
          )}

          {promoSuccess && <p className="text-sm text-green-600 font-medium">✅ บันทึกเรียบร้อยแล้ว</p>}

          <button
            onClick={savePromo}
            disabled={promoSaving}
            className="w-full bg-orange text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {promoSaving ? "กำลังบันทึก..." : "บันทึกโปรโมชั่น"}
          </button>
        </div>
      </div>

      {/* Payment Settings */}
      <div>
        <h1 className="text-xl font-bold text-navy mb-4">ตั้งค่าการชำระเงิน</h1>

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

        {/* PromptPay ID */}
        <div>
          <label className="text-sm font-semibold text-navy block mb-1">PromptPay ID</label>
          <input
            type="text"
            value={promptPayId}
            onChange={(e) => setPromptPayId(e.target.value)}
            className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none"
            placeholder="เบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก"
          />
          <p className="text-xs text-gray-400 mt-1">ใส่แล้ว QR จะฝังยอดเงินอัตโนมัติเมื่อสแกนจ่าย</p>
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
    </div>
  );
}
