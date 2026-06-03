"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

type StaffMember = {
  id: number;
  name: string;
  avatarUrl: string | null;
  isCheckedIn: boolean;
  hasCredential: boolean;
};

type Tab = "checkin" | "register";
type CheckinStep = "idle" | "camera" | "identifying" | "success" | "pin";
type RegisterStep = "pick" | "camera" | "saving" | "done";

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

export default function HrCheckinPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [tab, setTab] = useState<Tab>("checkin");

  // check-in state
  const [checkinStep, setCheckinStep] = useState<CheckinStep>("idle");
  const [checkinError, setCheckinError] = useState("");
  const [result, setResult] = useState<{ action: "checkin" | "checkout"; time: string; staffName: string } | null>(null);

  // PIN fallback state
  const [pinSelected, setPinSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);

  // register state
  const [regStep, setRegStep] = useState<RegisterStep>("pick");
  const [regTarget, setRegTarget] = useState<StaffMember | null>(null);
  const [regMsg, setRegMsg] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchStaff = useCallback(() =>
    fetch("/api/hr/staff").then(r => r.json()).then(setStaff).catch(() => {}), []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  // ── camera ──────────────────────────────────────────────────────────────

  const needsCamera =
    (tab === "checkin" && checkinStep === "camera") ||
    (tab === "register" && regStep === "camera");

  useEffect(() => {
    if (!needsCamera) { stopCamera(); return; }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (tab === "checkin") { setCheckinStep("idle"); setCheckinError("เปิดกล้องไม่ได้"); }
        if (tab === "register") { setRegStep("pick"); setRegMsg("เปิดกล้องไม่ได้"); }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsCamera]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  function capturePhoto(): string | null {
    if (!videoRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  // ── face identify check-in ───────────────────────────────────────────────

  async function doIdentify() {
    const photo = capturePhoto();
    if (!photo) return;
    stopCamera();
    setCheckinStep("identifying");
    setCheckinError("");

    const res = await fetch("/api/hr/face/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoBase64: photo }),
    });
    const data = await res.json();

    if (!res.ok) {
      setCheckinError(data.error ?? "ระบุตัวตนไม่ได้");
      setCheckinStep("idle");
      fetchStaff();
      return;
    }

    setResult(data);
    setCheckinStep("success");
    fetchStaff();
    setTimeout(() => { setCheckinStep("idle"); setResult(null); setCheckinError(""); }, 3500);
  }

  // ── PIN fallback ─────────────────────────────────────────────────────────

  function pressDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) { setPinError(""); setTimeout(() => submitPin(next), 150); }
  }

  async function submitPin(pinValue: string) {
    if (!pinSelected) return;
    setPinSubmitting(true);
    const res = await fetch("/api/hr/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: pinSelected.id, pin: pinValue }),
    });
    const data = await res.json();
    setPinSubmitting(false);
    if (res.ok) {
      setResult({ ...data, staffName: pinSelected.name });
      setCheckinStep("success");
      fetchStaff();
      setTimeout(() => { setCheckinStep("idle"); setPinSelected(null); setPin(""); setResult(null); }, 3500);
    } else {
      setPinError(data.error ?? "เกิดข้อผิดพลาด");
      setPin("");
    }
  }

  // ── face register ────────────────────────────────────────────────────────

  async function doRegister() {
    const photo = capturePhoto();
    if (!photo || !regTarget) return;
    stopCamera();
    setRegStep("saving");
    setRegMsg("กำลังบันทึกกับ Azure...");

    const res = await fetch("/api/hr/face/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: regTarget.id, photoBase64: photo }),
    });
    const data = await res.json();

    if (!res.ok) {
      setRegMsg(data.error ?? "บันทึกไม่สำเร็จ");
      setRegStep("pick");
      return;
    }

    await fetchStaff();
    setRegMsg(`ลงทะเบียนหน้าของ ${regTarget.name} สำเร็จ`);
    setRegStep("done");
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">

      {/* Tabs */}
      {checkinStep === "idle" && (
        <div className="flex border-b border-white/10">
          {(["checkin", "register"] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setCheckinError(""); }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${tab === t ? "text-[#fb8500] border-b-2 border-[#fb8500]" : "text-[#f8f1e5]/40"}`}>
              {t === "checkin" ? "เช็คอิน / เอาท์" : "ลงทะเบียนหน้า"}
            </button>
          ))}
        </div>
      )}

      {/* ── TAB: เช็คอิน ──────────────────────────────────────────── */}
      {tab === "checkin" && (
        <>
          {/* idle */}
          {checkinStep === "idle" && (
            <div className="flex-1 px-4 pt-5 pb-6">
              <button
                onClick={() => { setCheckinError(""); setCheckinStep("camera"); }}
                className="w-full mb-5 py-4 bg-[#fb8500] rounded-2xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <span>📷</span> สแกนหน้าเช็คอิน
              </button>

              {checkinError && (
                <p className="text-red-400 text-sm text-center mb-4">{checkinError}</p>
              )}

              <p className="text-[#f8f1e5]/40 text-xs text-center mb-3">หรือใช้ PIN แทน</p>
              <div className="grid grid-cols-2 gap-3">
                {staff.map(s => (
                  <button key={s.id}
                    onClick={() => { setPinSelected(s); setPin(""); setPinError(""); setCheckinStep("pin"); }}
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

          {/* camera */}
          {checkinStep === "camera" && (
            <div className="flex-1 flex flex-col">
              <div className="relative flex-1 bg-black min-h-0">
                <video ref={videoRef} autoPlay playsInline muted
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-56 rounded-full border-2 border-[#fb8500]/70"
                    style={{ boxShadow: "0 0 0 9999px rgba(24,42,71,0.55)" }} />
                </div>
                <p className="absolute bottom-20 left-0 right-0 text-center text-[#f8f1e5]/70 text-sm">
                  จ้องกล้องตรงๆ ภายในวงกลม
                </p>
              </div>
              <div className="px-4 py-4 flex gap-3">
                <button onClick={() => { stopCamera(); setCheckinStep("idle"); }}
                  className="flex-1 py-3 bg-white/5 rounded-2xl text-sm text-[#f8f1e5]/60">ยกเลิก</button>
                <button onClick={doIdentify}
                  className="flex-1 py-3 bg-[#fb8500] rounded-2xl text-sm font-bold">ถ่ายรูป</button>
              </div>
            </div>
          )}

          {/* identifying */}
          {checkinStep === "identifying" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <div className="w-12 h-12 border-2 border-white/20 border-t-[#fb8500] rounded-full animate-spin" />
              <p className="text-[#f8f1e5]/60 text-sm">กำลังระบุตัวตน...</p>
            </div>
          )}

          {/* PIN fallback */}
          {checkinStep === "pin" && pinSelected && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
              <div className="flex items-center gap-3">
                <Avatar s={pinSelected} size={12} />
                <div>
                  <p className="font-bold">{pinSelected.name}</p>
                  <p className="text-[#f8f1e5]/50 text-xs">{pinSelected.isCheckedIn ? "ลงชื่อออกงาน" : "ลงชื่อเข้างาน"}</p>
                </div>
              </div>
              <div className="flex gap-4">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-4 h-4 rounded-full transition-colors ${i < pin.length ? "bg-[#fb8500]" : "bg-white/20"}`} />
                ))}
              </div>
              {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
              {pinSubmitting && <p className="text-[#f8f1e5]/50 text-sm">กำลังตรวจสอบ...</p>}
              <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                {["1","2","3","4","5","6","7","8","9"].map(d => (
                  <button key={d} onClick={() => pressDigit(d)} disabled={pinSubmitting}
                    className="bg-white/10 rounded-2xl h-14 text-xl font-semibold active:bg-white/20 disabled:opacity-40">{d}</button>
                ))}
                <button onClick={() => { setCheckinStep("idle"); setPinSelected(null); setPin(""); }}
                  className="bg-white/5 rounded-2xl h-14 text-xs text-[#f8f1e5]/50">ยกเลิก</button>
                <button onClick={() => pressDigit("0")} disabled={pinSubmitting}
                  className="bg-white/10 rounded-2xl h-14 text-xl font-semibold active:bg-white/20 disabled:opacity-40">0</button>
                <button onClick={() => setPin(p => p.slice(0,-1))} disabled={pinSubmitting}
                  className="bg-white/5 rounded-2xl h-14 text-xl text-[#f8f1e5]/70">⌫</button>
              </div>
            </div>
          )}

          {/* success */}
          {checkinStep === "success" && result && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
              <div className={`text-6xl ${result.action === "checkin" ? "text-emerald-400" : "text-amber-400"}`}>
                {result.action === "checkin" ? "✓" : "👋"}
              </div>
              <div>
                <p className="text-2xl font-bold">{result.staffName}</p>
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

      {/* ── TAB: ลงทะเบียนหน้า ──────────────────────────────────── */}
      {tab === "register" && (
        <div className="flex-1 flex flex-col">
          {regStep === "pick" && (
            <div className="flex-1 px-4 pt-5">
              <p className="text-[#f8f1e5]/50 text-xs mb-4">เลือกพนักงานที่จะลงทะเบียนใบหน้า</p>
              {regMsg && <p className="text-red-400 text-sm text-center mb-3">{regMsg}</p>}
              <div className="flex flex-col gap-3">
                {staff.map(s => (
                  <button key={s.id}
                    onClick={() => { setRegTarget(s); setRegMsg(""); setRegStep("camera"); }}
                    className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl active:scale-[0.98] transition-transform text-left">
                    <Avatar s={s} size={12} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{s.name}</p>
                      <p className={`text-xs mt-0.5 ${s.hasCredential ? "text-emerald-400" : "text-[#f8f1e5]/40"}`}>
                        {s.hasCredential ? "ลงทะเบียนแล้ว ✓ (กดเพื่ออัปเดต)" : "ยังไม่ได้ลงทะเบียน"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {regStep === "camera" && regTarget && (
            <div className="flex-1 flex flex-col">
              <div className="relative flex-1 bg-black min-h-0">
                <video ref={videoRef} autoPlay playsInline muted
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-56 rounded-full border-2 border-[#fb8500]/70"
                    style={{ boxShadow: "0 0 0 9999px rgba(24,42,71,0.55)" }} />
                </div>
                <div className="absolute bottom-20 left-0 right-0 text-center">
                  <p className="font-semibold">{regTarget.name}</p>
                  <p className="text-[#f8f1e5]/60 text-xs mt-1">แสงดี · ตรงกล้อง · ห่าง 30-50 ซม.</p>
                </div>
              </div>
              <div className="px-4 py-4 flex gap-3">
                <button onClick={() => { stopCamera(); setRegStep("pick"); setRegTarget(null); }}
                  className="flex-1 py-3 bg-white/5 rounded-2xl text-sm text-[#f8f1e5]/60">ยกเลิก</button>
                <button onClick={doRegister}
                  className="flex-1 py-3 bg-[#fb8500] rounded-2xl text-sm font-bold">ถ่ายรูปลงทะเบียน</button>
              </div>
            </div>
          )}

          {regStep === "saving" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <div className="w-12 h-12 border-2 border-white/20 border-t-[#fb8500] rounded-full animate-spin" />
              <p className="text-[#f8f1e5]/60 text-sm">{regMsg}</p>
            </div>
          )}

          {regStep === "done" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
              <div className="text-5xl text-emerald-400">✓</div>
              <p className="font-bold text-lg">{regMsg}</p>
              <button onClick={() => { setRegStep("pick"); setRegTarget(null); setRegMsg(""); }}
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
