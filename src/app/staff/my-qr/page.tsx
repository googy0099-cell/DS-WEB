"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";

// Refresh a bit before the 30s token TTL so the displayed QR is always live.
const REFRESH_MS = 25_000;

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("อุปกรณ์นี้ไม่รองรับตำแหน่ง"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 15_000,
    });
  });
}

export default function MyCheckinQrPage() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_MS / 1000);
  const expiresRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await getPosition();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // Sent without coords; server decides if GPS is required.
      }

      const res = await fetch("/api/hr/checkin-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQrDataUrl(null);
        setError(data.error ?? "ขอ QR ไม่สำเร็จ");
        return;
      }
      setError("");
      const url = await QRCode.toDataURL(data.token, {
        width: 320,
        margin: 2,
        color: { dark: "#182a47", light: "#ffffff" },
      });
      setQrDataUrl(url);
      expiresRef.current = data.expiresAt;
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const kick = setTimeout(refresh, 0);
    const id = setInterval(refresh, REFRESH_MS);
    return () => { clearTimeout(kick); clearInterval(id); };
  }, [refresh]);

  // Countdown display
  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((expiresRef.current - Date.now()) / 1000));
      setSecondsLeft(left);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen px-4 pt-8 pb-10 max-w-md mx-auto flex flex-col items-center gap-5">
      <div className="w-full">
        <Link href="/staff" className="text-[#f8f1e5]/50 text-sm hover:text-[#f8f1e5]/80">← กลับ</Link>
      </div>

      <div className="text-center">
        <h1 className="text-xl font-bold text-[#f8f1e5]">QR เช็คอินของฉัน</h1>
        <p className="text-sm text-[#f8f1e5]/60 mt-1">
          ยื่นจอนี้ให้เครื่องแคชเชียร์สแกน แล้วมองกล้อง
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-lg p-6 w-full flex flex-col items-center gap-4">
        {loading ? (
          <div className="w-[280px] h-[280px] flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-orange border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="w-[280px] min-h-[280px] flex flex-col items-center justify-center text-center gap-3 px-4">
            <div className="text-4xl">📍</div>
            <p className="text-red-500 font-semibold">{error}</p>
            <button
              onClick={refresh}
              className="mt-2 bg-navy text-white text-sm font-bold px-5 py-2.5 rounded-xl active:scale-95 transition-transform"
            >
              ลองใหม่
            </button>
          </div>
        ) : (
          qrDataUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR เช็คอิน" className="w-[280px] h-[280px]" />
              <div className="w-full">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sage transition-all duration-1000 ease-linear"
                    style={{ width: `${(secondsLeft / (REFRESH_MS / 1000)) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">
                  QR เปลี่ยนอัตโนมัติใน {secondsLeft} วิ
                </p>
              </div>
            </>
          )
        )}
      </div>

      <p className="text-xs text-[#f8f1e5]/40 text-center px-6">
        ต้องอยู่ที่ร้านและอนุญาตตำแหน่ง QR จึงจะใช้งานได้
      </p>
    </div>
  );
}
