"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

type StaffMember = {
  id: number;
  name: string;
  avatarUrl: string | null;
  isCheckedIn: boolean;
  hasCredential: boolean;
};

type Tab = "checkin" | "register";
type CheckinStep = "idle" | "pin" | "success";
type RegisterStep = "pick" | "scanning" | "done";

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
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [result, setResult] = useState<{ action: "checkin" | "checkout"; time: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fingerError, setFingerError] = useState("");

  // register state
  const [regStep, setRegStep] = useState<RegisterStep>("pick");
  const [regTarget, setRegTarget] = useState<StaffMember | null>(null);
  const [regMsg, setRegMsg] = useState("");

  const fetchStaff = useCallback(() =>
    fetch("/api/hr/staff").then(r => r.json()).then(setStaff).catch(() => {}), []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  // ── fingerprint check-in ──────────────────────────────────────────────────

  async function fingerprintCheckin(s: StaffMember) {
    setSelected(s);
    setFingerError("");
    setSubmitting(true);
    try {
      const optRes = await fetch("/api/hr/webauthn/auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: s.id }),
      });
      if (!optRes.ok) {
        const d = await optRes.json();
        setFingerError(d.error ?? "เกิดข้อผิดพลาด");
        setSubmitting(false);
        return;
      }
      const options = await optRes.json();
      const credential = await startAuthentication(options);

      const verRes = await fetch("/api/hr/webauthn/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: s.id, credential }),
      });
      const verData = await verRes.json();
      if (!verRes.ok) {
        setFingerError(verData.error ?? "ยืนยันไม่สำเร็จ");
        setSubmitting(false);
        return;
      }

      setResult(verData);
      setCheckinStep("success");
      fetchStaff();
      setTimeout(() => { setCheckinStep("idle"); setSelected(null); setResult(null); setFingerError(""); }, 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("AbortError") || msg.includes("NotAllowedError")) {
        setFingerError("ยกเลิกการสแกนนิ้ว");
      } else {
        setFingerError("สแกนนิ้วไม่สำเร็จ");
      }
    }
    setSubmitting(false);
  }

  // ── PIN check-in (fallback) ────────────────────────────────────────────────

  function pressDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) { setPinError(""); setTimeout(() => submitPin(next), 150); }
  }

  async function submitPin(pinValue: string) {
    if (!selected) return;
    setSubmitting(true);
    const res = await fetch("/api/hr/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: selected.id, pin: pinValue }),
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
    }
  }

  // ── register fingerprint ──────────────────────────────────────────────────

  async function startFingerprintRegistration(s: StaffMember) {
    setRegTarget(s);
    setRegStep("scanning");
    setRegMsg("กำลังเตรียม...");
    try {
      const optRes = await fetch("/api/hr/webauthn/register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: s.id }),
      });
      if (!optRes.ok) {
        const d = await optRes.json();
        setRegMsg(d.error ?? "เกิดข้อผิดพลาด");
        setRegStep("pick");
        return;
      }
      const options = await optRes.json();
      setRegMsg("แตะเซ็นเซอร์นิ้วมือ...");
      const credential = await startRegistration(options);

      setRegMsg("กำลังบันทึก...");
      const verRes = await fetch("/api/hr/webauthn/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: s.id, credential }),
      });
      const verData = await verRes.json();
      if (!verRes.ok) {
        setRegMsg(verData.error ?? "บันทึกไม่สำเร็จ");
        setRegStep("pick");
        return;
      }

      await fetchStaff();
      setRegMsg(`ลงทะเบียนนิ้วของ ${s.name} สำเร็จ`);
      setRegStep("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("AbortError") || msg.includes("NotAllowedError")) {
        setRegMsg("ยกเลิกการลงทะเบียน");
      } else {
        setRegMsg("ลงทะเบียนไม่สำเร็จ — ลองใหม่");
      }
      setRegStep("pick");
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">

      {/* Tabs */}
      {checkinStep === "idle" && (
        <div className="flex border-b border-white/10">
          {(["checkin", "register"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${tab === t ? "text-[#fb8500] border-b-2 border-[#fb8500]" : "text-[#f8f1e5]/40"}`}>
              {t === "checkin" ? "เช็คอิน / เอาท์" : "ลงทะเบียนนิ้ว"}
            </button>
          ))}
        </div>
      )}

      {/* ── TAB: เช็คอิน ─────────────────────────────────────────────── */}
      {tab === "checkin" && (
        <>
          {/* idle: staff grid */}
          {checkinStep === "idle" && (
            <div className="flex-1 px-4 pt-5 pb-6">
              <p className="text-[#f8f1e5]/50 text-xs mb-4 text-center">แตะชื่อเพื่อเช็คอิน / เอาท์</p>
              <div className="grid grid-cols-2 gap-3">
                {staff.map(s => (
                  <button key={s.id}
                    onClick={() => {
                      if (s.hasCredential) {
                        fingerprintCheckin(s);
                      } else {
                        setSelected(s);
                        setPin("");
                        setPinError("");
                        setCheckinStep("pin");
                      }
                    }}
                    disabled={submitting && selected?.id === s.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3 active:scale-95 transition-transform text-left disabled:opacity-60">
                    <div className="relative shrink-0">
                      <Avatar s={s} size={12} />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#182a47] ${s.isCheckedIn ? "bg-emerald-400" : "bg-white/20"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{s.name}</p>
                      <p className={`text-xs ${s.isCheckedIn ? "text-emerald-400" : "text-[#f8f1e5]/40"}`}>
                        {submitting && selected?.id === s.id
                          ? "กำลังสแกน..."
                          : s.isCheckedIn ? "กำลังทำงาน" : "ยังไม่เข้า"}
                      </p>
                      {fingerError && selected?.id === s.id && (
                        <p className="text-red-400 text-[10px] mt-0.5">{fingerError}</p>
                      )}
                    </div>
                    {s.hasCredential && (
                      <span className="ml-auto text-lg shrink-0">👆</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* pin step (fallback for staff without fingerprint) */}
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
              {submitting && <p className="text-[#f8f1e5]/50 text-sm">กำลังตรวจสอบ...</p>}

              <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                {["1","2","3","4","5","6","7","8","9"].map(d => (
                  <button key={d} onClick={() => pressDigit(d)} disabled={submitting}
                    className="bg-white/10 rounded-2xl h-14 text-xl font-semibold active:bg-white/20 disabled:opacity-40">{d}</button>
                ))}
                <button onClick={() => { setCheckinStep("idle"); setSelected(null); setPin(""); }}
                  className="bg-white/5 rounded-2xl h-14 text-xs text-[#f8f1e5]/50">ยกเลิก</button>
                <button onClick={() => pressDigit("0")} disabled={submitting}
                  className="bg-white/10 rounded-2xl h-14 text-xl font-semibold active:bg-white/20 disabled:opacity-40">0</button>
                <button onClick={() => setPin(p => p.slice(0,-1))} disabled={submitting}
                  className="bg-white/5 rounded-2xl h-14 text-xl text-[#f8f1e5]/70">⌫</button>
              </div>
            </div>
          )}

          {/* success */}
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

      {/* ── TAB: ลงทะเบียนนิ้ว ────────────────────────────────────── */}
      {tab === "register" && (
        <div className="flex-1 flex flex-col">
          {regStep === "pick" && (
            <div className="flex-1 px-4 pt-5">
              <p className="text-[#f8f1e5]/50 text-xs mb-4">เลือกพนักงานที่จะลงทะเบียนลายนิ้วมือ</p>
              <div className="flex flex-col gap-3">
                {staff.map(s => (
                  <button key={s.id}
                    onClick={() => startFingerprintRegistration(s)}
                    className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl active:scale-[0.98] transition-transform text-left">
                    <Avatar s={s} size={12} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{s.name}</p>
                      <p className={`text-xs mt-0.5 ${s.hasCredential ? "text-emerald-400" : "text-[#f8f1e5]/40"}`}>
                        {s.hasCredential ? "ลงทะเบียนแล้ว ✓ (กดเพื่ออัปเดต)" : "ยังไม่ได้ลงทะเบียน"}
                      </p>
                    </div>
                    <span className="text-2xl shrink-0">👆</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {regStep === "scanning" && regTarget && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
              <div className="text-7xl animate-pulse">👆</div>
              <div>
                <p className="font-bold text-lg">{regTarget.name}</p>
                <p className="text-[#f8f1e5]/60 text-sm mt-1">{regMsg}</p>
              </div>
              <button onClick={() => { setRegStep("pick"); setRegTarget(null); }}
                className="text-[#f8f1e5]/40 text-sm">ยกเลิก</button>
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
