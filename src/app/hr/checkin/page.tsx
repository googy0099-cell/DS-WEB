"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type StaffMember = {
  id: number;
  name: string;
  avatarUrl: string | null;
  isCheckedIn: boolean;
};

type Step = "grid" | "pin" | "camera" | "success";

export default function HrCheckinPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [step, setStep] = useState<Step>("grid");
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [result, setResult] = useState<{ action: "checkin" | "checkout"; time: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetch("/api/hr/staff")
      .then((r) => r.json())
      .then(setStaff)
      .catch(() => {});
  }, []);

  // Start camera when step = camera
  useEffect(() => {
    if (step !== "camera") {
      stopCamera();
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setStep("pin"));
  }, [step]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function selectStaff(s: StaffMember) {
    setSelected(s);
    setPin("");
    setPinError("");
    setStep("pin");
  }

  function pressDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setPinError("");
      // brief visual delay then open camera
      setTimeout(() => setStep("camera"), 150);
    }
  }

  function pressDelete() {
    setPin((p) => p.slice(0, -1));
    setPinError("");
  }

  async function captureAndSubmit() {
    if (!videoRef.current || !selected) return;
    setLoading(true);

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const photoBase64 = canvas.toDataURL("image/jpeg", 0.7);

    try {
      const res = await fetch("/api/hr/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: selected.id, pin, photoBase64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error ?? "เกิดข้อผิดพลาด");
        setPin("");
        setStep("pin");
      } else {
        setResult(data);
        setStep("success");
        // refresh staff list
        fetch("/api/hr/staff")
          .then((r) => r.json())
          .then(setStaff)
          .catch(() => {});
        setTimeout(() => {
          setStep("grid");
          setSelected(null);
          setPin("");
          setResult(null);
        }, 3000);
      }
    } catch {
      setPinError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setStep("pin");
    } finally {
      setLoading(false);
    }
  }

  // ── Grid ──────────────────────────────────────────────────────────────────
  if (step === "grid") {
    return (
      <div className="min-h-screen p-5 flex flex-col">
        <div className="mb-6 text-center">
          <p className="text-[#f8f1e5]/60 text-sm mt-1">แตะชื่อของคุณเพื่อลงชื่อเข้า/ออก</p>
        </div>

        {staff.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[#f8f1e5]/40 text-sm">
            ยังไม่มีพนักงานในระบบ
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {staff.map((s) => (
              <button
                key={s.id}
                onClick={() => selectStaff(s)}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-3 active:scale-95 transition-transform"
              >
                <div className="relative">
                  {s.avatarUrl ? (
                    <Image
                      src={s.avatarUrl}
                      alt={s.name}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold text-[#fb8500]">
                      {s.name.charAt(0)}
                    </div>
                  )}
                  <span
                    className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#182a47] ${
                      s.isCheckedIn ? "bg-emerald-400" : "bg-white/30"
                    }`}
                  />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm text-[#f8f1e5]">{s.name}</p>
                  <p className={`text-xs mt-0.5 ${s.isCheckedIn ? "text-emerald-400" : "text-[#f8f1e5]/40"}`}>
                    {s.isCheckedIn ? "กำลังทำงาน" : "ยังไม่เข้างาน"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── PIN ───────────────────────────────────────────────────────────────────
  if (step === "pin") {
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6">
        <div className="text-center">
          <p className="text-[#f8f1e5]/60 text-sm">
            {selected?.isCheckedIn ? "ลงชื่อออกงาน" : "ลงชื่อเข้างาน"}
          </p>
          <p className="text-xl font-bold mt-1">{selected?.name}</p>
        </div>

        <div className="flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-colors ${
                i < pin.length ? "bg-[#fb8500]" : "bg-white/20"
              }`}
            />
          ))}
        </div>

        {pinError && <p className="text-red-400 text-sm text-center">{pinError}</p>}

        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {digits.slice(0, 9).map((d) => (
            <button
              key={d}
              onClick={() => pressDigit(d)}
              className="bg-white/10 rounded-2xl h-16 text-2xl font-semibold active:bg-white/20 transition-colors"
            >
              {d}
            </button>
          ))}
          <button
            onClick={() => { setStep("grid"); setPin(""); }}
            className="bg-white/5 rounded-2xl h-16 text-sm text-[#f8f1e5]/50 active:bg-white/10 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => pressDigit("0")}
            className="bg-white/10 rounded-2xl h-16 text-2xl font-semibold active:bg-white/20 transition-colors"
          >
            0
          </button>
          <button
            onClick={pressDelete}
            className="bg-white/5 rounded-2xl h-16 text-2xl text-[#f8f1e5]/70 active:bg-white/10 transition-colors"
          >
            ⌫
          </button>
        </div>
      </div>
    );
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  if (step === "camera") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6">
        <p className="text-[#f8f1e5]/60 text-sm">ถ่ายรูปเพื่อยืนยัน</p>
        <div className="relative w-full max-w-xs aspect-square rounded-3xl overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          <div className="absolute inset-0 border-2 border-[#fb8500]/50 rounded-3xl pointer-events-none" />
        </div>
        <button
          onClick={captureAndSubmit}
          disabled={loading}
          className="w-20 h-20 rounded-full bg-[#fb8500] flex items-center justify-center text-3xl shadow-lg active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? (
            <span className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            "📷"
          )}
        </button>
        <button
          onClick={() => { setStep("pin"); setPin(""); }}
          className="text-[#f8f1e5]/40 text-sm"
        >
          ย้อนกลับ
        </button>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (step === "success" && result) {
    const isIn = result.action === "checkin";
    const time = new Date(result.time).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className={`text-6xl ${isIn ? "text-emerald-400" : "text-amber-400"}`}>
          {isIn ? "✓" : "👋"}
        </div>
        <div>
          <p className="text-2xl font-bold">{selected?.name}</p>
          <p className={`text-lg mt-1 ${isIn ? "text-emerald-400" : "text-amber-400"}`}>
            {isIn ? "เข้างานแล้ว" : "ออกงานแล้ว"}
          </p>
          <p className="text-[#f8f1e5]/50 text-sm mt-1">{time} น.</p>
        </div>
      </div>
    );
  }

  return null;
}
