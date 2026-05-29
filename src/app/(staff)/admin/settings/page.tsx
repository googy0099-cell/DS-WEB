"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import {
  isSerialSupported, requestPrinter, getGrantedPrinter,
  getBaudRate, setBaudRate, buildReceiptEscPos, buildKitchenEscPos, printToSerial,
} from "@/lib/thermal-print";

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
  print_receipt?: string;
  print_kitchen?: string;
}

const DEFAULT_RECEIPT_SETTINGS = {
  shopName: "ร้านลูกเต๋า",
  shopInfo: "The Dice Shop",
  paperWidth: "80",
  footer: "ขอบคุณที่ใช้บริการ 🎲",
  showOrderId: true,
  showDate: true,
  showCustomer: true,
  showNote: true,
  showItemPrice: true,
  showTotal: true,
};

const DEFAULT_KITCHEN_SETTINGS = {
  enabled: false,
  paperWidth: "80",
  showTable: true,
  showNote: true,
};

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

  // Print settings — receipt
  const [rShopName, setRShopName] = useState(DEFAULT_RECEIPT_SETTINGS.shopName);
  const [rShopInfo, setRShopInfo] = useState(DEFAULT_RECEIPT_SETTINGS.shopInfo);
  const [rPaperWidth, setRPaperWidth] = useState(DEFAULT_RECEIPT_SETTINGS.paperWidth);
  const [rFooter, setRFooter] = useState(DEFAULT_RECEIPT_SETTINGS.footer);
  const [rLogoUrl, setRLogoUrl] = useState("");
  const [rLogoUploading, setRLogoUploading] = useState(false);
  const [rShowOrderId, setRShowOrderId] = useState(DEFAULT_RECEIPT_SETTINGS.showOrderId);
  const [rShowDate, setRShowDate] = useState(DEFAULT_RECEIPT_SETTINGS.showDate);
  const [rShowCustomer, setRShowCustomer] = useState(DEFAULT_RECEIPT_SETTINGS.showCustomer);
  const [rShowNote, setRShowNote] = useState(DEFAULT_RECEIPT_SETTINGS.showNote);
  const [rShowItemPrice, setRShowItemPrice] = useState(DEFAULT_RECEIPT_SETTINGS.showItemPrice);
  const [rShowTotal, setRShowTotal] = useState(DEFAULT_RECEIPT_SETTINGS.showTotal);

  // Print settings — kitchen
  const [kEnabled, setKEnabled] = useState(DEFAULT_KITCHEN_SETTINGS.enabled);
  const [kPaperWidth, setKPaperWidth] = useState(DEFAULT_KITCHEN_SETTINGS.paperWidth);
  const [kShowTable, setKShowTable] = useState(DEFAULT_KITCHEN_SETTINGS.showTable);
  const [kShowNote, setKShowNote] = useState(DEFAULT_KITCHEN_SETTINGS.showNote);

  const [printLoaded, setPrintLoaded] = useState(false);
  const [printSaving, setPrintSaving] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);

  // Serial printer state
  const [serialSupported, setSerialSupported] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [baudRate, setBaudRateState] = useState(9600);
  const [serialTesting, setSerialTesting] = useState(false);
  const [serialStatus, setSerialStatus] = useState<"" | "ok" | "fail">("");

  useEffect(() => {
    setSerialSupported(isSerialSupported());
    setBaudRateState(getBaudRate());
    getGrantedPrinter().then((p) => setPrinterConnected(!!p));
  }, []);

  if (siteSettings && !promoLoaded) {
    setPromoTitle(siteSettings.promo_title ?? "🎉 โปรโมชั่นพิเศษ!");
    setPromoBody(siteSettings.promo_body ?? "สั่งครบ ฿300 รับเครื่องดื่มฟรี 1 แก้ว (ทุกวัน 15:00 – 17:00)");
    setPromoEnabled(siteSettings.promo_enabled !== "false");
    setPromoLoaded(true);
  }

  if (siteSettings && !printLoaded) {
    try {
      const r = { ...DEFAULT_RECEIPT_SETTINGS, ...JSON.parse(siteSettings.print_receipt ?? "{}") };
      setRShopName(r.shopName); setRShopInfo(r.shopInfo); setRPaperWidth(r.paperWidth);
      setRFooter(r.footer); setRLogoUrl(r.logoUrl ?? ""); setRShowOrderId(r.showOrderId);
      setRShowDate(r.showDate); setRShowCustomer(r.showCustomer); setRShowNote(r.showNote);
      setRShowItemPrice(r.showItemPrice); setRShowTotal(r.showTotal);
    } catch {}
    try {
      const k = { ...DEFAULT_KITCHEN_SETTINGS, ...JSON.parse(siteSettings.print_kitchen ?? "{}") };
      setKEnabled(k.enabled); setKPaperWidth(k.paperWidth);
      setKShowTable(k.showTable); setKShowNote(k.showNote);
    } catch {}
    setPrintLoaded(true);
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
  async function savePrintSettings() {
    setPrintSaving(true);
    setPrintSuccess(false);
    try {
      await fetch("/api/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          print_receipt: JSON.stringify({ shopName: rShopName, shopInfo: rShopInfo, paperWidth: rPaperWidth, footer: rFooter, logoUrl: rLogoUrl, showOrderId: rShowOrderId, showDate: rShowDate, showCustomer: rShowCustomer, showNote: rShowNote, showItemPrice: rShowItemPrice, showTotal: rShowTotal }),
          print_kitchen: JSON.stringify({ enabled: kEnabled, paperWidth: kPaperWidth, showTable: kShowTable, showNote: kShowNote }),
        }),
      });
      await mutateSite();
      setPrintSuccess(true);
    } finally {
      setPrintSaving(false);
    }
  }

  async function handleSelectPrinter() {
    const port = await requestPrinter();
    setPrinterConnected(!!port);
  }

  function handleBaudChange(rate: number) {
    setBaudRateState(rate);
    setBaudRate(rate);
  }

  async function handleSerialTestPrint() {
    setSerialTesting(true);
    setSerialStatus("");
    const sampleReceipt: Parameters<typeof buildReceiptEscPos>[0] = {
      id: 999,
      orderName: "ทดสอบ",
      totalTHB: 150,
      note: "ไม่ใส่น้ำตาล",
      createdAt: new Date().toISOString(),
      items: [
        { nameTh: "ชาไทย", selectedSize: "XL", selectedAddons: null, selectedOptions: null, quantity: 2, unitPriceTHB: 55 },
        { nameTh: "กาแฟ", selectedSize: null, selectedAddons: null, selectedOptions: null, quantity: 1, unitPriceTHB: 40 },
      ],
    };
    const data = buildReceiptEscPos(sampleReceipt, {
      shopName: rShopName, shopInfo: rShopInfo, footer: rFooter,
      showOrderId: rShowOrderId, showDate: rShowDate, showCustomer: rShowCustomer,
      showNote: rShowNote, showItemPrice: rShowItemPrice, showTotal: rShowTotal,
    });
    const ok = await printToSerial(data);
    setSerialStatus(ok ? "ok" : "fail");
    setSerialTesting(false);
  }

  function testReceiptPrint() {
    const w = rPaperWidth === "A4" ? "210mm" : `${rPaperWidth}mm`;
    const html = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><title>ทดสอบใบเสร็จ</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Sarabun','Helvetica Neue',Arial,sans-serif;font-size:13px;color:#111;width:${w};margin:0 auto;padding:8px}.logo{display:block;max-width:120px;max-height:60px;margin:0 auto 6px;object-fit:contain}h1{font-size:18px;font-weight:900;text-align:center;margin-bottom:2px}.sub{font-size:11px;text-align:center;color:#555;margin-bottom:8px}.div{border:none;border-top:1px dashed #aaa;margin:6px 0}table{width:100%;border-collapse:collapse}.tr{font-weight:bold;font-size:15px;padding-top:6px;border-top:1px dashed #aaa}.note{background:#fff8e7;border:1px solid #f5a623;border-radius:4px;padding:5px 8px;margin-top:6px;font-size:12px}.footer{text-align:center;font-size:11px;color:#777;margin-top:10px}@media print{body{width:100%}}</style></head>
<body>
${rLogoUrl ? `<img src="${rLogoUrl}" class="logo" alt="logo"/>` : ""}
<h1>${rLogoUrl ? "" : "🎲 "}${rShopName}</h1><div class="sub">${rShopInfo} • ใบเสร็จรับเงิน</div><hr class="div"/>
<div style="font-size:12px;margin-bottom:4px">
${rShowCustomer ? `<div><b>ออเดอร์:</b> ทดสอบ</div>` : ""}
${rShowOrderId ? `<div><b>เลขที่:</b> #999</div>` : ""}
${rShowDate ? `<div><b>วันที่:</b> ทดสอบ</div>` : ""}
</div><hr class="div"/>
<table><tbody>
<tr><td style="padding:4px 2px">ชาไทย (XL) ×2</td>${rShowItemPrice ? `<td style="text-align:right;padding:4px 2px">฿110</td>` : ""}</tr>
<tr><td style="padding:4px 2px">กาแฟ ×1</td>${rShowItemPrice ? `<td style="text-align:right;padding:4px 2px">฿40</td>` : ""}</tr>
</tbody>${rShowTotal ? `<tfoot><tr><td style="font-weight:bold;padding-top:6px;border-top:1px dashed #aaa">รวมทั้งหมด</td><td style="font-weight:bold;text-align:right;padding-top:6px;border-top:1px dashed #aaa">฿150</td></tr></tfoot>` : ""}</table>
${rShowNote ? `<div class="note">📝 หมายเหตุ: ไม่ใส่น้ำตาล</div>` : ""}
<div class="footer">${rFooter}</div>
</body></html>`;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  function testKitchenPrint() {
    const w = kPaperWidth === "A4" ? "210mm" : `${kPaperWidth}mm`;
    const html = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><title>ทดสอบใบครัว</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Sarabun','Helvetica Neue',Arial,sans-serif;font-size:14px;color:#111;width:${w};margin:0 auto;padding:8px}h1{font-size:16px;font-weight:900;text-align:center;margin-bottom:4px}.div{border:none;border-top:1px dashed #aaa;margin:6px 0}.item{padding:3px 0;font-size:14px}@media print{body{width:100%}}</style></head>
<body>
<h1>🍳 ใบแจ้งครัว (ทดสอบ)</h1>
${kShowTable ? `<div style="font-size:12px;text-align:center">โต๊ะ 3 — ออเดอร์ #999 — ทดสอบ</div>` : `<div style="font-size:12px;text-align:center">ออเดอร์ #999 — ทดสอบ</div>`}
<hr class="div"/>
<div class="item">• ชาไทย (XL) ×2</div>
<div class="item">• กาแฟ ×1</div>
${kShowNote ? `<hr class="div"/><div style="font-size:12px">📝 ไม่ใส่น้ำตาล</div>` : ""}
</body></html>`;
    const win = window.open("", "_blank", "width=400,height=500");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
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

      {/* Print Settings */}
      <div>
        <h1 className="text-xl font-bold text-navy mb-4">🖨️ ตั้งค่าการพิมพ์</h1>

        {/* Printer connection */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4 mb-4">
          <h2 className="font-semibold text-navy border-b border-sand pb-2">เชื่อมต่อเครื่องพิมพ์</h2>

          {!serialSupported ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-amber-800">ต้องใช้ Google Chrome หรือ Edge</p>
              <p className="text-xs text-amber-700">การพิมพ์ตรงไปยังเครื่องพิมพ์ (ไม่มีหน้าต่าง) ต้องใช้ Web Serial API ซึ่งรองรับเฉพาะ Chrome / Edge</p>
              <p className="text-xs text-amber-700 mt-1">ถ้ายังต้องการใช้ Safari/Firefox — กด "ทดสอบพิมพ์" ข้างล่างเพื่อตั้งค่าเครื่องพิมพ์ใน browser แทน</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full shrink-0 ${printerConnected ? "bg-green-500" : "bg-gray-300"}`} />
                <span className="text-sm text-navy font-medium">
                  {printerConnected ? "เชื่อมต่อแล้ว — พร้อมพิมพ์อัตโนมัติ" : "ยังไม่ได้เลือกเครื่องพิมพ์"}
                </span>
              </div>

              <div>
                <label className="text-sm font-semibold text-navy block mb-2">Baud Rate <span className="font-normal text-gray-400">(ความเร็วพอร์ต)</span></label>
                <div className="flex gap-2 flex-wrap">
                  {[9600, 19200, 38400, 115200].map((rate) => (
                    <button key={rate} onClick={() => handleBaudChange(rate)}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${baudRate === rate ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"}`}>
                      {rate}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">ส่วนใหญ่ใช้ 9600 — ถ้าพิมพ์ผิดลองเปลี่ยนเป็น 115200</p>
              </div>

              <div className="flex gap-2">
                <button onClick={handleSelectPrinter}
                  className="flex-1 bg-navy text-cream font-semibold py-2.5 rounded-xl text-sm hover:bg-navy/90">
                  {printerConnected ? "🔄 เปลี่ยนเครื่องพิมพ์" : "🖨️ เลือกเครื่องพิมพ์"}
                </button>
                {printerConnected && (
                  <button onClick={handleSerialTestPrint} disabled={serialTesting}
                    className="flex-1 border border-orange text-orange font-semibold py-2.5 rounded-xl text-sm hover:bg-orange/5 disabled:opacity-50">
                    {serialTesting ? "กำลังพิมพ์..." : "ทดสอบพิมพ์ (ไม่มีหน้าต่าง)"}
                  </button>
                )}
              </div>

              {serialStatus === "ok" && <p className="text-sm text-green-600 font-medium">✅ พิมพ์สำเร็จ! ตรวจสอบเครื่องพิมพ์</p>}
              {serialStatus === "fail" && <p className="text-sm text-red-500 font-medium">❌ พิมพ์ไม่ได้ — ตรวจสอบ baud rate หรือการเชื่อมต่อ USB</p>}

              <p className="text-xs text-gray-400">เมื่อเลือกเครื่องพิมพ์แล้ว กด 🖨️ ในการ์ดออเดอร์จะพิมพ์ออกเลย ไม่มีหน้าต่างยืนยัน</p>
            </>
          )}
        </div>

        {/* Receipt */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4 mb-4">
          <h2 className="font-semibold text-navy border-b border-sand pb-2">ใบเสร็จลูกค้า</h2>

          {/* Logo upload */}
          <div>
            <label className="text-sm font-semibold text-navy block mb-2">โลโก้บนใบเสร็จ <span className="font-normal text-gray-400">(ไม่บังคับ)</span></label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-16 rounded-xl border-2 border-sand flex items-center justify-center overflow-hidden shrink-0 bg-sand/20">
                {rLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={rLogoUrl} alt="logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-2xl">🏪</span>
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <label className={`cursor-pointer inline-block border-2 border-dashed rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${rLogoUploading ? "border-gray-200 text-gray-400" : "border-orange/40 text-orange hover:border-orange hover:bg-orange/5"}`}>
                  {rLogoUploading ? "⏳ กำลังอัพโหลด..." : rLogoUrl ? "🔄 เปลี่ยนโลโก้" : "📷 อัพโหลดโลโก้"}
                  <input type="file" accept="image/*" className="hidden" disabled={rLogoUploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setRLogoUploading(true);
                      const fd = new FormData(); fd.append("file", f);
                      const res = await fetch("/api/upload", { method: "POST", body: fd });
                      const d = await res.json();
                      if (d.url) setRLogoUrl(d.url);
                      else alert(d.error ?? "อัพโหลดไม่สำเร็จ");
                      setRLogoUploading(false);
                      e.target.value = "";
                    }} />
                </label>
                {rLogoUrl && (
                  <button onClick={() => setRLogoUrl("")} className="block text-xs text-red-400 hover:underline">ลบโลโก้</button>
                )}
                <p className="text-xs text-gray-400">PNG/JPG โปร่งใสได้ · แสดงบนสุดของใบเสร็จ</p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-navy block mb-1">ชื่อร้านบนใบเสร็จ</label>
            <input type="text" value={rShopName} onChange={(e) => setRShopName(e.target.value)}
              className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none" />
          </div>

          <div>
            <label className="text-sm font-semibold text-navy block mb-1">บรรทัดที่สอง <span className="font-normal text-gray-400">(ที่อยู่ / เบอร์โทร / ไม่บังคับ)</span></label>
            <input type="text" value={rShopInfo} onChange={(e) => setRShopInfo(e.target.value)}
              placeholder="เช่น 099-999-9999 • ลาดพร้าว 80"
              className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none" />
          </div>

          <div>
            <label className="text-sm font-semibold text-navy block mb-2">ขนาดกระดาษ</label>
            <div className="flex gap-2">
              {[["80", "80mm (Thermal)"], ["58", "58mm (Thermal)"], ["A4", "A4"]].map(([val, label]) => (
                <button key={val} onClick={() => setRPaperWidth(val)}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${rPaperWidth === val ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-navy block mb-2">ข้อมูลที่แสดงบนใบเสร็จ</label>
            <div className="space-y-2">
              {[
                ["showOrderId", "เลขที่ออเดอร์", rShowOrderId, setRShowOrderId],
                ["showDate", "วันและเวลา", rShowDate, setRShowDate],
                ["showCustomer", "ชื่อลูกค้า", rShowCustomer, setRShowCustomer],
                ["showItemPrice", "ราคาต่อรายการ", rShowItemPrice, setRShowItemPrice],
                ["showTotal", "ยอดรวม", rShowTotal, setRShowTotal],
                ["showNote", "หมายเหตุ", rShowNote, setRShowNote],
              ].map(([key, label, val, setter]) => (
                <label key={key as string} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={val as boolean} onChange={(e) => (setter as (v: boolean) => void)(e.target.checked)} className="accent-orange w-4 h-4" />
                  <span className="text-navy">{label as string}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-navy block mb-1">ข้อความท้ายใบเสร็จ</label>
            <input type="text" value={rFooter} onChange={(e) => setRFooter(e.target.value)}
              className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none" />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={testReceiptPrint}
              className="flex-1 border border-orange text-orange font-semibold py-2.5 rounded-xl text-sm hover:bg-orange/5">
              🖨️ ทดสอบพิมพ์
            </button>
            <button onClick={savePrintSettings} disabled={printSaving}
              className="flex-1 bg-orange text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
              {printSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>

        {/* Kitchen Ticket */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-sand">
            <h2 className="font-semibold text-navy">ใบแจ้งครัว</h2>
            <button onClick={() => setKEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${kEnabled ? "bg-orange" : "bg-gray-300"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${kEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {!kEnabled && <p className="text-sm text-gray-400 text-center py-2">เปิดใช้งานเพื่อแสดงปุ่ม "🍳 แจ้งครัว" ในการ์ดออเดอร์</p>}

          {kEnabled && (
            <>
              <div>
                <label className="text-sm font-semibold text-navy block mb-2">ขนาดกระดาษ</label>
                <div className="flex gap-2">
                  {[["80", "80mm"], ["58", "58mm"], ["A4", "A4"]].map(([val, label]) => (
                    <button key={val} onClick={() => setKPaperWidth(val)}
                      className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${kPaperWidth === val ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={kShowTable} onChange={(e) => setKShowTable(e.target.checked)} className="accent-orange w-4 h-4" />
                  <span className="text-navy">แสดงเลขโต๊ะ</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={kShowNote} onChange={(e) => setKShowNote(e.target.checked)} className="accent-orange w-4 h-4" />
                  <span className="text-navy">แสดงหมายเหตุ</span>
                </label>
              </div>
            </>
          )}

          {printSuccess && <p className="text-sm text-green-600 font-medium">✅ บันทึกเรียบร้อยแล้ว</p>}

          <div className="flex gap-2 pt-1">
            {kEnabled && (
              <button onClick={testKitchenPrint}
                className="flex-1 border border-orange text-orange font-semibold py-2.5 rounded-xl text-sm hover:bg-orange/5">
                🍳 ทดสอบพิมพ์ใบครัว
              </button>
            )}
            <button onClick={savePrintSettings} disabled={printSaving}
              className="flex-1 bg-orange text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
              {printSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3 text-center">
          💡 ต้องใช้ Chrome หรือ Edge เพื่อเชื่อมต่อเครื่องพิมพ์โดยตรง — Safari / Firefox ใช้ปุ่ม "ทดสอบพิมพ์" แล้ว browser จะจำเครื่องพิมพ์ไว้
        </p>
      </div>
    </div>
  );
}
