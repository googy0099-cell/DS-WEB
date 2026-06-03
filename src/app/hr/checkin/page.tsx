"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { loadModels, getDescriptor, getAverageDescriptor, matchDescriptor } from "@/lib/hr-face";

type StaffMember = {
  id: number;
  name: string;
  avatarUrl: string | null;
  isCheckedIn: boolean;
  faceData: string | null;
};

type Step = "loading" | "scan" | "matched" | "pin" | "camera" | "registering" | "success";

export default function HrCheckinPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [modelsReady, setModelsReady] = useState(false);
  const [step, setStep] = useState<Step>("loading");
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [result, setResult] = useState<{ action: "checkin" | "checkout"; time: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState("กำลังโหลด AI...");
  const [registerTarget, setRegisterTarget] = useState<StaffMember | null>(null);
  const [registerProgress, setRegisterProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScanning = useRef(false);

  const fetchStaff = useCallback(() =>
    fetch("/api/hr/staff").then((r) => r.json()).then(setStaff).catch(() => {}), []);

  useEffect(() => {
    fetchStaff();
    loadModels()
      .then(() => { setModelsReady(true); setStep("scan"); })
      .catch(() => setScanStatus("โหลด AI ไม่สำเร็จ — ใช้ PIN แทน"));
  }, [fetchStaff]);

  // Start camera on scan/camera/registering step
  useEffect(() => {
    if (step !== "scan" && step !== "camera" && step !== "registering") { stopCamera(); return; }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        if (step === "scan") startScanLoop();
      })
      .catch(() => setStep("pin"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function stopCamera() {
    if (scanLoopRef.current) clearTimeout(scanLoopRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    isScanning.current = false;
  }

  function startScanLoop() {
    isScanning.current = true;
    setScanStatus("กำลังสแกนใบหน้า...");

    const candidates = staff
      .filter((s) => s.faceData)
      .map((s) => ({
        id: s.id,
        descriptor: new Float32Array(JSON.parse(s.faceData!)),
      }));

    if (candidates.length === 0) {
      setScanStatus("ยังไม่มีพนักงานลงทะเบียนใบหน้า");
      return;
    }

    async function loop() {
      if (!isScanning.current || !videoRef.current) return;
      const descriptor = await getDescriptor(videoRef.current).catch(() => null);
      if (descriptor) {
        const match = matchDescriptor(descriptor, candidates);
        if (match) {
          const found = staff.find((s) => s.id === match.id);
          if (found) {
            isScanning.current = false;
            setSelected(found);
            setStep("matched");
            stopCamera();
            return;
          }
        }
      }
      scanLoopRef.current = setTimeout(loop, 500);
    }
    loop();
  }

  async function confirmMatch() {
    if (!selected) return;
    setPin("");
    setPinError("");
    setStep("pin"); // ต้องยืนยัน PIN เสมอ แม้จำหน้าได้
  }

  async function captureAndSubmit() {
    if (!videoRef.current || !selected) return;
    setLoading(true);
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const photoBase64 = canvas.toDataURL("image/jpeg", 0.7);
    stopCamera();
    await submitAttendance(photoBase64);
  }

  async function submitAttendance(photoBase64?: string) {
    if (!selected) return;
    setLoading(true);
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
        fetchStaff();
        setTimeout(() => { setStep("scan"); setSelected(null); setPin(""); setResult(null); }, 3000);
      }
    } catch {
      setPinError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setStep("pin");
    } finally {
      setLoading(false);
    }
  }

  // Face registration
  async function startRegister(s: StaffMember) {
    setRegisterTarget(s);
    setRegisterProgress(0);
    setStep("registering");
  }

  useEffect(() => {
    if (step !== "registering" || !registerTarget || !videoRef.current) return;
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 800)); // wait for camera
      if (cancelled || !videoRef.current) return;
      let collected = 0;
      const samples: Float32Array[] = [];
      setScanStatus("จ้องมองตรงกล้อง ถ่าย 5 ภาพ...");
      for (let i = 0; i < 5; i++) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 600));
        const d = await getDescriptor(videoRef.current!).catch(() => null);
        if (d) { samples.push(d); collected++; setRegisterProgress(collected * 20); }
      }
      if (samples.length < 3) { setScanStatus("ตรวจจับหน้าไม่สำเร็จ ลองใหม่"); return; }
      const avg = new Float32Array(128);
      samples.forEach((s) => s.forEach((v, i) => { avg[i] += v / samples.length; }));
      stopCamera();
      await fetch(`/api/hr/staff/${registerTarget!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceData: JSON.stringify(Array.from(avg)) }),
      });
      await fetchStaff();
      setStep("scan");
      setRegisterTarget(null);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, registerTarget]);

  // PIN digit handler
  function pressDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) { setPinError(""); setTimeout(() => setStep("camera"), 150); }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#fb8500]/40 border-t-[#fb8500] rounded-full animate-spin" />
        <p className="text-[#f8f1e5]/50 text-sm">{scanStatus}</p>
      </div>
    );
  }

  // ── Face scan ─────────────────────────────────────────────────────────────
  if (step === "scan") {
    const hasFaceStaff = staff.filter((s) => s.faceData);
    return (
      <div className="min-h-screen flex flex-col">
        {/* Camera */}
        <div className="relative flex-1 bg-black overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          {/* Scan overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="w-52 h-52 rounded-full border-2 border-[#fb8500]/60" style={{ boxShadow: "0 0 0 9999px rgba(24,42,71,0.5)" }} />
          </div>
          <div className="absolute bottom-6 left-0 right-0 text-center">
            <p className="text-white/80 text-sm font-medium">{scanStatus}</p>
          </div>
        </div>

        {/* Staff grid + register buttons */}
        <div className="bg-[#182a47] px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-[#f8f1e5]/50">หรือเลือกชื่อแล้วกด PIN</p>
          </div>
          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {staff.map((s) => (
              <div key={s.id} className="relative">
                <button
                  onClick={() => { setSelected(s); setPin(""); setPinError(""); setStep("pin"); }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2 flex flex-col items-center gap-1.5"
                >
                  <div className="relative">
                    {s.avatarUrl ? (
                      <Image src={s.avatarUrl} alt={s.name} width={36} height={36} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-[#fb8500]">
                        {s.name.charAt(0)}
                      </div>
                    )}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#182a47] ${s.isCheckedIn ? "bg-emerald-400" : "bg-white/20"}`} />
                  </div>
                  <p className="text-[10px] text-center text-[#f8f1e5]/70 leading-tight truncate w-full">{s.name.split(" ")[0]}</p>
                </button>
                {/* Register face button */}
                {!s.faceData && modelsReady && (
                  <button
                    onClick={() => startRegister(s)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-[#fb8500] rounded-full text-[9px] flex items-center justify-center"
                    title="ลงทะเบียนใบหน้า"
                  >
                    +
                  </button>
                )}
              </div>
            ))}
          </div>
          {hasFaceStaff.length === 0 && (
            <p className="text-center text-[#f8f1e5]/30 text-xs mt-2">กด + ที่รูปพนักงานเพื่อลงทะเบียนใบหน้า</p>
          )}
        </div>
      </div>
    );
  }

  // ── Matched ───────────────────────────────────────────────────────────────
  if (step === "matched" && selected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6">
        <div className="w-24 h-24 rounded-full bg-[#fb8500]/20 border-2 border-[#fb8500] flex items-center justify-center text-4xl">
          {selected.avatarUrl ? (
            <Image src={selected.avatarUrl} alt={selected.name} width={96} height={96} className="w-24 h-24 rounded-full object-cover" />
          ) : selected.name.charAt(0)}
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{selected.name}</p>
          <p className="text-[#f8f1e5]/50 text-sm mt-1">ตรวจพบใบหน้าแล้ว</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={confirmMatch} className="w-full py-4 bg-[#fb8500] text-white font-bold rounded-2xl text-lg">
            {selected.isCheckedIn ? "ออกงาน ✓" : "เข้างาน ✓"}
          </button>
          <button onClick={() => { setStep("scan"); setSelected(null); }} className="text-[#f8f1e5]/40 text-sm text-center">
            ไม่ใช่ฉัน
          </button>
        </div>
      </div>
    );
  }

  // ── Registering ───────────────────────────────────────────────────────────
  if (step === "registering") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5">
        <p className="text-sm font-semibold">{registerTarget?.name}</p>
        <div className="relative w-64 h-64 rounded-full overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" stroke="#fb8500" strokeWidth="2"
              strokeDasharray={`${registerProgress * 3.016} 301.6`} strokeLinecap="round" transform="rotate(-90 50 50)" />
          </svg>
        </div>
        <p className="text-[#f8f1e5]/60 text-sm">{scanStatus}</p>
        <button onClick={() => { stopCamera(); setStep("scan"); }} className="text-[#f8f1e5]/30 text-xs">ยกเลิก</button>
      </div>
    );
  }

  // ── PIN ───────────────────────────────────────────────────────────────────
  if (step === "pin") {
    const digits = ["1","2","3","4","5","6","7","8","9","0"];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6">
        <div className="text-center">
          <p className="text-[#f8f1e5]/60 text-sm">{selected?.isCheckedIn ? "ลงชื่อออกงาน" : "ลงชื่อเข้างาน"}</p>
          <p className="text-xl font-bold mt-1">{selected?.name}</p>
        </div>
        <div className="flex gap-4">
          {[0,1,2,3].map((i) => (
            <div key={i} className={`w-4 h-4 rounded-full transition-colors ${i < pin.length ? "bg-[#fb8500]" : "bg-white/20"}`} />
          ))}
        </div>
        {pinError && <p className="text-red-400 text-sm text-center">{pinError}</p>}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {digits.slice(0,9).map((d) => (
            <button key={d} onClick={() => pressDigit(d)} className="bg-white/10 rounded-2xl h-16 text-2xl font-semibold active:bg-white/20 transition-colors">{d}</button>
          ))}
          <button onClick={() => { setStep("scan"); setSelected(null); setPin(""); }} className="bg-white/5 rounded-2xl h-16 text-sm text-[#f8f1e5]/50 active:bg-white/10">ยกเลิก</button>
          <button onClick={() => pressDigit("0")} className="bg-white/10 rounded-2xl h-16 text-2xl font-semibold active:bg-white/20">0</button>
          <button onClick={() => setPin((p) => p.slice(0,-1))} className="bg-white/5 rounded-2xl h-16 text-2xl text-[#f8f1e5]/70 active:bg-white/10">⌫</button>
        </div>
      </div>
    );
  }

  // ── Camera (photo after PIN) ───────────────────────────────────────────────
  if (step === "camera") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6">
        <p className="text-[#f8f1e5]/60 text-sm">ถ่ายรูปเพื่อยืนยัน</p>
        <div className="relative w-full max-w-xs aspect-square rounded-3xl overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
        </div>
        <button onClick={captureAndSubmit} disabled={loading}
          className="w-20 h-20 rounded-full bg-[#fb8500] flex items-center justify-center text-3xl shadow-lg active:scale-95 disabled:opacity-50">
          {loading ? <span className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : "📷"}
        </button>
        <button onClick={() => { setStep("pin"); setPin(""); }} className="text-[#f8f1e5]/40 text-sm">ย้อนกลับ</button>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (step === "success" && result) {
    const isIn = result.action === "checkin";
    const time = new Date(result.time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className={`text-6xl ${isIn ? "text-emerald-400" : "text-amber-400"}`}>{isIn ? "✓" : "👋"}</div>
        <div>
          <p className="text-2xl font-bold">{selected?.name}</p>
          <p className={`text-lg mt-1 ${isIn ? "text-emerald-400" : "text-amber-400"}`}>{isIn ? "เข้างานแล้ว" : "ออกงานแล้ว"}</p>
          <p className="text-[#f8f1e5]/50 text-sm mt-1">{time} น.</p>
        </div>
      </div>
    );
  }

  return null;
}
