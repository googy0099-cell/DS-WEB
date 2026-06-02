"use client";

import Link from "next/link";
import { useState } from "react";

const MODULES = [
  {
    href: "/admin/analytics/sales",
    icon: "💰",
    title: "สรุปยอดขาย",
    desc: "รายได้รายวัน, จำนวนบิล, ค่าเฉลี่ย, ออเดอร์ที่ยกเลิก",
    color: "bg-green-50 border-green-200",
    iconBg: "bg-green-100 text-green-700",
  },
  {
    href: "/admin/analytics/menu",
    icon: "🍽️",
    title: "เมนูขายดี",
    desc: "จัดอันดับเมนูตามจำนวนชิ้นและยอดเงิน (ไม่รวมแพ็กเกจเวลา)",
    color: "bg-orange/5 border-orange/20",
    iconBg: "bg-orange/10 text-orange",
  },
  {
    href: "/admin/analytics/gametime",
    icon: "⏱️",
    title: "แพ็กเกจเวลา",
    desc: "จำนวนและรายได้จากแพ็กเกจชั่วโมงเกม",
    color: "bg-sky-50 border-sky-200",
    iconBg: "bg-sky-100 text-sky-700",
  },
  {
    href: "/admin/analytics/drawer",
    icon: "🗃️",
    title: "รายงานลิ้นชัก",
    desc: "ประวัติการเปิด/ปิดลิ้นชักเงินสด",
    color: "bg-blue-50 border-blue-200",
    iconBg: "bg-blue-100 text-blue-700",
  },
  {
    href: "/admin/analytics/orders",
    icon: "📋",
    title: "ประวัติออเดอร์",
    desc: "ค้นหาและกรองออเดอร์ตามวันที่, สถานะ, ประเภท",
    color: "bg-purple-50 border-purple-200",
    iconBg: "bg-purple-100 text-purple-700",
  },
  {
    href: "/admin/analytics/parties",
    icon: "🎉",
    title: "ประวัติปาร์ตี้",
    desc: "ข้อมูลตี้, ผู้เล่น, แพ็กเกจ, รายได้รวมแต่ละงาน",
    color: "bg-rose-50 border-rose-200",
    iconBg: "bg-rose-100 text-rose-600",
  },
  {
    href: "/admin/analytics/receipts",
    icon: "🧾",
    title: "ใบเสร็จดิจิตอล",
    desc: "ประวัติใบเสร็จทุกใบ กรองตามวันที่ ดูและดาวน์โหลด PDF สำหรับฝ่ายบัญชี",
    color: "bg-teal-50 border-teal-200",
    iconBg: "bg-teal-100 text-teal-700",
  },
];

const CSV_SHEETS = [
  { key: "sales",    label: "ยอดขายรายวัน" },
  { key: "menu",     label: "เมนูขายดี" },
  { key: "gametime", label: "แพ็กเกจเวลา" },
  { key: "parties",  label: "ปาร์ตี้" },
  { key: "receipts", label: "ใบเสร็จ" },
];

function todayBKK() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
function startOfMonthBKK() {
  return todayBKK().slice(0, 7) + "-01";
}

export default function AnalyticsHubPage() {
  const [from, setFrom] = useState(startOfMonthBKK());
  const [to, setTo] = useState(todayBKK());
  const [uploading, setUploading] = useState(false);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [driveError, setDriveError] = useState("");

  function downloadCsv(sheet: string) {
    const url = `/api/analytics/export?from=${from}&to=${to}&sheet=${sheet}`;
    const a = document.createElement("a");
    a.href = url;
    a.click();
  }

  async function uploadToDrive() {
    setUploading(true); setDriveError(""); setDriveUrl(null);
    try {
      const res = await fetch("/api/analytics/drive-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) { setDriveError(data.error ?? "อัปโหลดไม่สำเร็จ"); return; }
      setDriveUrl(data.url);
    } catch {
      setDriveError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-navy">วิเคราะห์ข้อมูล</h1>
        <p className="text-gray-400 text-sm">เลือกรายงานที่ต้องการดู</p>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-8">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href}
            className={`flex items-center gap-4 p-5 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow ${m.color}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${m.iconBg}`}>
              {m.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-navy text-base">{m.title}</p>
              <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{m.desc}</p>
            </div>
            <span className="text-gray-300 text-xl shrink-0">›</span>
          </Link>
        ))}
      </div>

      {/* Export section */}
      <div className="bg-white rounded-2xl shadow-sm p-5 border border-sand/50">
        <h2 className="font-bold text-navy mb-1">ดาวน์โหลดข้อมูล</h2>
        <p className="text-xs text-gray-400 mb-4">เลือกช่วงวันที่แล้วดาวน์โหลดเป็น CSV หรืออัปโหลดขึ้น Google Drive เป็น Google Sheets</p>

        {/* Date range */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <label className="text-xs text-gray-500 shrink-0">ตั้งแต่</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-sand rounded-xl px-3 py-1.5 text-sm focus:border-orange focus:outline-none"
          />
          <label className="text-xs text-gray-500 shrink-0">ถึง</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-sand rounded-xl px-3 py-1.5 text-sm focus:border-orange focus:outline-none"
          />
        </div>

        {/* CSV downloads */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">ดาวน์โหลด CSV</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {CSV_SHEETS.map((s) => (
            <button
              key={s.key}
              onClick={() => downloadCsv(s.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 hover:border-orange text-gray-700 text-xs font-medium rounded-xl transition-colors"
            >
              ⬇️ {s.label}
            </button>
          ))}
        </div>

        {/* Google Drive upload */}
        <div className="border-t border-sand/50 pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">อัปโหลดขึ้น Google Drive</p>
          <p className="text-xs text-gray-400 mb-3">
            สร้าง Google Sheets ไฟล์เดียว มี 5 ชีต (ยอดขาย, เมนู, แพ็กเกจ, ปาร์ตี้, ใบเสร็จ) ลงในโฟลเดอร์ Drive ที่ตั้งค่าไว้
          </p>
          <button
            onClick={uploadToDrive}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {uploading ? (
              <><span className="animate-spin">⏳</span> กำลังอัปโหลด...</>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
                อัปโหลดขึ้น Google Drive
              </>
            )}
          </button>
          {driveError && <p className="text-xs text-red-500 mt-2">{driveError}</p>}
          {driveUrl && (
            <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              <span className="text-green-600 text-sm">✅ อัปโหลดสำเร็จ!</span>
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#1a73e8] underline underline-offset-2 hover:text-[#1557b0] font-semibold"
              >
                เปิด Google Sheets →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
