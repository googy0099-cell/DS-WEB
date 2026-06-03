"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { loadModels, getDescriptor, matchDescriptor, getAverageDescriptor } from "@/lib/hr-face";

type StaffMember = {
  id: number;
  name: string;
  avatarUrl: string | null;
  isCheckedIn: boolean;
  faceData: string | null;
};

type Tab = "checkin" | "register";
type CheckinStep = "idle" | "scan" | "pin" | "camera" | "success";
type RegisterStep = "pick" | "scanning" | "done";

// ── helpers ───────────────────────────────────────────────────────────────

function Avatar({ s, size = 14 }: { s: StaffMember; size?: number }) {
  const sz = `w-${size} h-${size}`;
  return s.avatarUrl ? (
    <Image src={s.avatarUrl} alt={s.name} width={56} height={56}
      className={`${sz} rounded-full object-cover`} />
  ) : (
    <div className={`${sz} rounded-full bg-white/10 flex items-center justify-center font-bold text-[#fb8500]`}>
      {s.name.charAt(0)}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────

export default function HrCheckinPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [tab, setTab] = useState<Tab>("checkin");
  const [modelsReady, setModelsReady] = useState(false);
  const [modelsError, setModelsError] = useState(false);

  // check-in state
  const [checkinStep, setCheckinStep] = useState<CheckinStep>("idle");
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [result, setResult] = useState<{ action: "checkin" | "checkout"; time: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scanMsg, setScanMsg] = useState("");

  // register state
  const [regStep, setRegStep] = useState<RegisterStep>("pick");
  const [regTarget, setRegTarget] = useState<StaffMember | null>(null);
  const [regProgress, setRegProgress] = useState(0);
  const [regMsg, setRegMsg] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanningRef = useRef(false);

  const fetchStaff = useCallback(() =>
    fetch("/api/hr/staff").then(r => r.json()).then(setStaff).catch(() => {}), []);

  useEffect(() => {
    fetchStaff();
    loadModels()
      .then(() => setModelsReady(true))
      .catch(() => setModelsError(true));
  }, [fetchStaff]);

  // ── camera management ────────────────────────────────────────────────────

  const needsCamera = (tab === "checkin" && checkinStep === "scan") ||
    (tab === "checkin" && checkinStep === "camera") ||
    (tab === "register" && regStep === "scanning");

  useEffect(() => {
    if (!needsCamera) {
      stopCamera();
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        if (tab === "checkin" && checkinStep === "scan") startFaceScan();
      })
      .catch(() => {
        if (tab === "checkin") setCheckinStep("pin");
        if (tab === "register") { setRegStep("pick"); setRegMsg("กล้องเปิดไม่ได้"); }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsCamera]);

  function stopCamera() {
    scanningRef.current = false;
    if (scanLoopRef.current) clearTimeout(scanLoopRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  // ── face scan loop ────────────────────────────────────────────────────────

  function startFaceScan() {
    if (!modelsReady) return;
    scanningRef.current = true;
    setScanMsg("กำลังสแกน...");

    const candidates = staff
      .filter(s => s.faceData)
      .map(s => ({ id: s.id, descriptor: new Float32Array(JSON.parse(s.faceData!)) }));

    if (candidates.length === 0) {
      setScanMsg("ยังไม่มีใครลงทะเบียนใบหน้า");
      return;
    }

    let streak = 0;
    let streakId: number | null = null;
    const HITS = 3;

    async function loop() {
      if (!scanningRef.current || !videoRef.current) return;
      const desc = await getDescriptor(videoRef.current).catch(() => null);
      if (desc) {
        const match = matchDescriptor(desc, candidates, 0.45);
        if (match && match.id === streakId) {
          streak++;
          const found = staff.find(s => s.id === match.id);
          setScanMsg(`${found?.name} — ยืนยัน ${streak}/${HITS}`);
          if (streak >= HITS) {
            scanningRef.current = false;
            const found2 = staff.find(s => s.id === match.id)!;
            setSelected(found2);
            setScanMsg("");
            setPin("");
            setPinError("");
            setCheckinStep("pin");
            return;
          }
        } else {
          streak = match ? 1 : 0;
          streakId = match?.id ?? null;
          if (match) {
            const found = staff.find(s => s.id === match.id);
            setScanMsg(`พบ: ${found?.name} (${streak}/${HITS})`);
          } else {
            setScanMsg("กำลังสแกน...");
          }
        }
      } else {
        if (streak > 0) { streak = 0; streakId = null; setScanMsg("กำลังสแกน..."); }
      }
      scanLoopRef.current = setTimeout(loop, 450);
    }
    loop();
  }

  // ── check-in submit ────────────────────────────────────────────────────────

  function pressDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) { setPinError(""); setTimeout(() => setCheckinStep("camera"), 150); }
  }

  async function captureAndSubmit() {
    if (!videoRef.current || !selected) return;
    setSubmitting(true);
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const photoBase64 = canvas.toDataURL("image/jpeg", 0.7);
    stopCamera();

    const res = await fetch("/api/hr/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: selected.id, pin, photoBase64 }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setResult(data);
      setCheckinStep("success");
      fetchStaff();
      setTimeout(() => { setCheckinStep("idle"); setSelected(null); setPin(""); setResult(null); }, 3000);
    } else {
      setPinError(data.error ?? "เกิดข้อผิดพลาด");
      setPin("");
      setCheckinStep("pin");
    }
  }

  // ── register face ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (tab !== "register" || regStep !== "scanning" || !regTarget) return;
    let cancelled = false;
    setRegMsg("จ้องกล้องตรงๆ...");
    setRegProgress(0);

    (async () => {
      await new Promise(r => setTimeout(r, 800));
      if (cancelled || !videoRef.current) return;

      const samples: Float32Array[] = [];
      for (let i = 0; i < 8; i++) {
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 500));
        if (!videoRef.current) return;
        setRegMsg(`ถ่ายตัวอย่าง ${i + 1}/8...`);
        const d = await getDescriptor(videoRef.current).catch(() => null);
        if (d) { samples.push(d); setRegProgress(samples.length); }
      }

      if (samples.length < 4) {
        setRegMsg("ตรวจจับหน้าไม่ได้ — ลองใหม่ (แสงต้องดี ตรงกล้อง)");
        setRegStep("pick");
        return;
      }

      const avg = new Float32Array(128);
      samples.forEach(s => s.forEach((v, i) => { avg[i] += v / samples.length; }));

      stopCamera();
      await fetch(`/api/hr/staff/${regTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceData: JSON.stringify(Array.from(avg)) }),
      });
      await fetchStaff();
      setRegMsg(`บันทึกใบหน้าของ ${regTarget.name} แล้ว`);
      setRegStep("done");
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, regStep, regTarget]);

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">

      {/* Tabs */}
      {checkinStep === "idle" && (
        <div className="flex border-b border-white/10">
          {(["checkin", "register"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${tab === t ? "text-[#fb8500] border-b-2 border-[#fb8500]" : "text-[#f8f1e5]/40"}`}>
              {t === "checkin" ? "เช็คอิน / เอาท์" : "ลงทะเบียนใบหน้า"}
            </button>
          ))}
        </div>
      )}

      {/* ── TAB: เช็คอิน ─────────────────────────────────────────────── */}
      {tab === "checkin" && (
        <>
          {/* idle: show staff grid */}
          {checkinStep === "idle" && (
            <div className="flex-1 px-4 pt-5 pb-6">
              <p className="text-[#f8f1e5]/50 text-xs mb-4 text-center">แตะชื่อ หรือ สแกนหน้าอัตโนมัติ</p>

              {modelsReady && !modelsError && (
                <button
                  onClick={() => setCheckinStep("scan")}
                  className="w-full mb-4 py-3.5 bg-[#fb8500] rounded-2xl font-bold flex items-center justify-center gap-2">
                  <span className="text-lg">📷</span> สแกนใบหน้า
                </button>
              )}
              {modelsError && (
                <div className="mb-4 text-center text-[#f8f1e5]/40 text-xs bg-white/5 rounded-xl py-3">
                  โหลด AI ไม่ได้ — ใช้ PIN แทน
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {staff.map(s => (
                  <button key={s.id}
                    onClick={() => { setSelected(s); setPin(""); setPinError(""); setCheckinStep("pin"); }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3 active:scale-95 transition-transform text-left">
                    <div className="relative shrink-0">
                      <Avatar s={s} size={12} />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#182a47] ${s.isCheckedIn ? "bg-emerald-400" : "bg-white/20"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{s.name}</p>
                      <p className={`text-xs ${s.isCheckedIn ? "text-emerald-400" : "text-[#f8f1e5]/40"}`}>
                        {s.isCheckedIn ? "กำลังทำงาน" : "ยังไม่เข้า"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* scan step */}
          {checkinStep === "scan" && (
            <div className="flex-1 flex flex-col">
              <div className="relative flex-1 bg-black min-h-0">
                <video ref={videoRef} autoPlay playsInline muted
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-56 rounded-full border-2 border-[#fb8500]/70"
                    style={{ boxShadow: "0 0 0 9999px rgba(24,42,71,0.55)" }} />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#182a47] pt-8 pb-4 text-center">
                  <p className="text-sm font-medium text-[#f8f1e5]/80">{scanMsg}</p>
                </div>
              </div>
              <div className="px-4 py-4">
                <button onClick={() => { stopCamera(); setCheckinStep("idle"); }}
                  className="w-full py-3 bg-white/5 rounded-2xl text-sm text-[#f8f1e5]/60">
                  ยกเลิก / ใช้ PIN แทน
                </button>
              </div>
            </div>
          )}

          {/* pin step */}
          {checkinStep === "pin" && selected && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
              <div className="flex items-center gap-3">
                <Avatar s={selected} size={12} />
                <div>
                  <p className="font-bold">{selected.name}</p>
                  <p className="text-[#f8f1e5]/50 text-xs">{selected.isCheckedIn ? "ลงชื่อออกงาน" : "ลงชื่อเข้างาน"}</p>
                </div>
              </div>

              <div className="flex gap-4">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-4 h-4 rounded-full transition-colors ${i < pin.length ? "bg-[#fb8500]" : "bg-white/20"}`} />
                ))}
              </div>
              {pinError && <p className="text-red-400 text-sm">{pinError}</p>}

              <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                {["1","2","3","4","5","6","7","8","9"].map(d => (
                  <button key={d} onClick={() => pressDigit(d)}
                    className="bg-white/10 rounded-2xl h-14 text-xl font-semibold active:bg-white/20">{d}</button>
                ))}
                <button onClick={() => { setCheckinStep("idle"); setSelected(null); setPin(""); }}
                  className="bg-white/5 rounded-2xl h-14 text-xs text-[#f8f1e5]/50">ยกเลิก</button>
                <button onClick={() => pressDigit("0")}
                  className="bg-white/10 rounded-2xl h-14 text-xl font-semibold active:bg-white/20">0</button>
                <button onClick={() => setPin(p => p.slice(0,-1))}
                  className="bg-white/5 rounded-2xl h-14 text-xl text-[#f8f1e5]/70">⌫</button>
              </div>
            </div>
          )}

          {/* camera step */}
          {checkinStep === "camera" && selected && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <p className="text-[#f8f1e5]/60 text-sm">ถ่ายรูปยืนยัน</p>
              <div className="relative w-full max-w-xs aspect-square rounded-3xl overflow-hidden bg-black">
                <video ref={videoRef} autoPlay playsInline muted
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
              </div>
              <button onClick={captureAndSubmit} disabled={submitting}
                className="w-20 h-20 rounded-full bg-[#fb8500] flex items-center justify-center text-3xl shadow-lg active:scale-95 disabled:opacity-50">
                {submitting ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "📷"}
              </button>
              <button onClick={() => { setCheckinStep("pin"); setPin(""); }}
                className="text-[#f8f1e5]/40 text-sm">ย้อนกลับ</button>
            </div>
          )}

          {/* success step */}
          {checkinStep === "success" && result && selected && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
              <div className={`text-6xl ${result.action === "checkin" ? "text-emerald-400" : "text-amber-400"}`}>
                {result.action === "checkin" ? "✓" : "👋"}
              </div>
              <div>
                <p className="text-2xl font-bold">{selected.name}</p>
                <p className={`text-lg mt-1 ${result.action === "checkin" ? "text-emerald-400" : "text-amber-400"}`}>
                  {result.action === "checkin" ? "เข้างานแล้ว" : "ออกงานแล้ว"}
                </p>
                <p className="text-[#f8f1e5]/50 text-sm mt-1">
                  {new Date(result.time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: ลงทะเบียนใบหน้า ──────────────────────────────────── */}
      {tab === "register" && (
        <div className="flex-1 flex flex-col">
          {regStep === "pick" && (
            <div className="flex-1 px-4 pt-5">
              <p className="text-[#f8f1e5]/50 text-xs mb-4">เลือกพนักงานที่จะลงทะเบียนใบหน้า</p>
              {!modelsReady && !modelsError && (
                <p className="text-center text-[#f8f1e5]/40 text-sm py-6">กำลังโหลด AI...</p>
              )}
              {modelsError && (
                <p className="text-center text-red-400 text-sm py-6">โหลด AI ไม่สำเร็จ — ไม่สามารถลงทะเบียนใบหน้าได้</p>
              )}
              {modelsReady && (
                <div className="flex flex-col gap-3">
                  {staff.map(s => (
                    <button key={s.id}
                      onClick={() => { setRegTarget(s); setRegStep("scanning"); setRegMsg(""); setRegProgress(0); }}
                      className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl active:scale-[0.98] transition-transform text-left">
                      <Avatar s={s} size={12} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{s.name}</p>
                        <p className={`text-xs mt-0.5 ${s.faceData ? "text-emerald-400" : "text-[#f8f1e5]/40"}`}>
                          {s.faceData ? "ลงทะเบียนแล้ว ✓ (กดเพื่ออัปเดต)" : "ยังไม่ได้ลงทะเบียน"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {regStep === "scanning" && regTarget && (
            <div className="flex-1 flex flex-col">
              <div className="relative flex-1 bg-black min-h-0">
                <video ref={videoRef} autoPlay playsInline muted
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                {/* Progress ring overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-56 h-56">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                      <circle cx="50" cy="50" r="48" fill="none" stroke="#fb8500" strokeWidth="2"
                        strokeDasharray={`${(regProgress / 8) * 301.6} 301.6`} strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#182a47] pt-8 pb-4 text-center px-4">
                  <p className="font-semibold">{regTarget.name}</p>
                  <p className="text-[#f8f1e5]/60 text-sm mt-1">{regMsg}</p>
                  <p className="text-[#f8f1e5]/30 text-xs mt-1">แสงดี · ตรงกล้อง · ห่าง 30-50 ซม.</p>
                </div>
              </div>
              <div className="px-4 py-4">
                <button onClick={() => { stopCamera(); setRegStep("pick"); setRegTarget(null); }}
                  className="w-full py-3 bg-white/5 rounded-2xl text-sm text-[#f8f1e5]/60">ยกเลิก</button>
              </div>
            </div>
          )}

          {regStep === "done" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
              <div className="text-5xl text-emerald-400">✓</div>
              <p className="font-bold text-lg">{regMsg}</p>
              <button onClick={() => { setRegStep("pick"); setRegTarget(null); }}
                className="bg-[#fb8500] text-white font-bold px-6 py-3 rounded-2xl">
                ลงทะเบียนคนต่อไป
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
