"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  loadModels,
  detectMetrics,
  updateBlinkState,
  type LivenessMetrics,
  type BlinkState,
} from "@/lib/hr-face";

type StaffMember = {
  id: number;
  name: string;
  avatarUrl: string | null;
  isCheckedIn: boolean;
  hasAttendanceToday: boolean;
  hasCredential: boolean;
};

type CheckinStep = "idle" | "camera" | "identifying" | "success";
type CheckinMode = "checkin" | "checkout";

type ChallengeType = "blink" | "mouth" | "left" | "right";
const CHALLENGE_LABEL: Record<ChallengeType, string> = {
  blink: "กระพริบตาแรงๆ 1 ครั้ง",
  mouth: "อ้าปากกว้างค้างไว้",
  left: "หันหน้าไปทางซ้าย",
  right: "หันหน้าไปทางขวา",
};
const CHALLENGES: ChallengeType[] = ["blink", "mouth", "left", "right"];

const CHALLENGES_PER_SCAN = 3;
const PER_CHALLENGE_TIMEOUT_MS = 10000;
const DETECT_INTERVAL_MS = 100;

function pickChallengeSequence(n: number): ChallengeType[] {
  const pool = [...CHALLENGES];
  const out: ChallengeType[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function Avatar({ s, size = 14 }: { s: StaffMember; size?: number }) {
  const sz = `w-${size} h-${size}`;
  return s.avatarUrl ? (
    <Image
      src={s.avatarUrl}
      alt={s.name}
      width={56}
      height={56}
      className={`${sz} rounded-full object-cover`}
    />
  ) : (
    <div
      className={`${sz} rounded-full bg-white/10 flex items-center justify-center font-bold text-[#fb8500]`}
    >
      {s.name.charAt(0)}
    </div>
  );
}

export default function HrCheckinPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [modelsReady, setModelsReady] = useState(false);

  const [mode, setMode] = useState<CheckinMode | null>(null);
  const [checkinStep, setCheckinStep] = useState<CheckinStep>("idle");
  const [checkinTarget, setCheckinTarget] = useState<StaffMember | null>(null);
  const [challengeSequence, setChallengeSequence] = useState<ChallengeType[]>([]);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [challengeProgress, setChallengeProgress] = useState("");
  const [checkinError, setCheckinError] = useState("");
  const [result, setResult] = useState<{
    action: "checkin" | "checkout";
    time: string;
    staffName: string;
    status: string | null;
    similarity: number;
  } | null>(null);
  const [checklistBlock, setChecklistBlock] = useState<{
    doneCount: number; totalCount: number; canForce: boolean;
    staffId: number; photo: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const livenessLoopRef = useRef<number | null>(null);
  const livenessStartRef = useRef<number>(0);
  const blinkStateRef = useRef<BlinkState>({ eyesOpen: true, blinkCount: 0 });
  const holdStartRef = useRef<number | null>(null);
  const modeRef = useRef<CheckinMode | null>(null);

  // Keep modeRef in sync with mode state (needed inside animation frame callback)
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── data ──────────────────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    const res = await fetch("/api/hr/staff");
    if (res.ok) setStaff(await res.json());
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  useEffect(() => {
    loadModels()
      .then(() => setModelsReady(true))
      .catch(() => setModelsReady(false));
  }, []);

  // ── camera ────────────────────────────────────────────────────────────────

  const needsCamera = checkinStep === "camera";

  useEffect(() => {
    if (!needsCamera) {
      stopCamera();
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
      })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        resetCheckin();
        setCheckinError("เปิดกล้องไม่ได้");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsCamera]);

  function stopCamera() {
    if (livenessLoopRef.current) {
      cancelAnimationFrame(livenessLoopRef.current);
      livenessLoopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function capturePhoto(): string | null {
    if (!videoRef.current) return null;
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  // ── liveness loop ─────────────────────────────────────────────────────────

  function checkChallengeMet(m: LivenessMetrics, ch: ChallengeType, now: number): boolean {
    switch (ch) {
      case "blink": {
        blinkStateRef.current = updateBlinkState(blinkStateRef.current, m.ear);
        const state = blinkStateRef.current.eyesOpen ? "ตาเปิด" : "ตาปิด";
        setChallengeProgress(
          `${state} (EAR ${m.ear.toFixed(2)}) — กระพริบ ${blinkStateRef.current.blinkCount}/1`
        );
        return blinkStateRef.current.blinkCount >= 1;
      }
      case "mouth": {
        const open = m.mouthOpen > 0.35;
        if (open) {
          if (holdStartRef.current === null) holdStartRef.current = now;
          const held = now - holdStartRef.current;
          setChallengeProgress(`อ้าปาก ${(held / 1000).toFixed(1)}s / 0.5s`);
          return held >= 500;
        } else {
          holdStartRef.current = null;
          setChallengeProgress("อ้าปากกว้างขึ้น");
          return false;
        }
      }
      case "left": {
        const turned = m.yaw > 0.15;
        if (turned) {
          if (holdStartRef.current === null) holdStartRef.current = now;
          return now - holdStartRef.current >= 500;
        }
        holdStartRef.current = null;
        setChallengeProgress("หันมากขึ้น");
        return false;
      }
      case "right": {
        const turned = m.yaw < -0.15;
        if (turned) {
          if (holdStartRef.current === null) holdStartRef.current = now;
          return now - holdStartRef.current >= 500;
        }
        holdStartRef.current = null;
        setChallengeProgress("หันมากขึ้น");
        return false;
      }
    }
  }

  function resetChallengeState() {
    blinkStateRef.current = { eyesOpen: true, blinkCount: 0 };
    holdStartRef.current = null;
    setChallengeProgress("");
  }

  function startLivenessLoop(sequence: ChallengeType[]) {
    livenessStartRef.current = performance.now();
    resetChallengeState();
    let currentIdx = 0;
    let lastDetect = 0;

    const tick = async () => {
      const now = performance.now();

      if (now - livenessStartRef.current > PER_CHALLENGE_TIMEOUT_MS) {
        stopCamera();
        setCheckinError(`หมดเวลาท่าที่ ${currentIdx + 1} ลองใหม่`);
        setCheckinStep("idle");
        setCheckinTarget(null);
        return;
      }

      if (now - lastDetect >= DETECT_INTERVAL_MS && videoRef.current && videoRef.current.readyState === 4) {
        lastDetect = now;
        try {
          const m = await detectMetrics(videoRef.current);
          if (m) {
            const ch = sequence[currentIdx];
            const passed = checkChallengeMet(m, ch, now);
            if (passed) {
              currentIdx += 1;
              if (currentIdx >= sequence.length) {
                const photo = capturePhoto();
                stopCamera();
                if (!photo || !checkinTarget) {
                  setCheckinError("จับภาพไม่ได้");
                  setCheckinStep("idle");
                  setCheckinTarget(null);
                  return;
                }
                await submitIdentify(checkinTarget.id, photo, false, modeRef.current ?? "checkin");
                return;
              }
              livenessStartRef.current = performance.now();
              resetChallengeState();
              setChallengeIndex(currentIdx);
            }
          } else {
            setChallengeProgress("มองตรงๆ ที่กล้อง");
          }
        } catch {
          // continue loop
        }
      }

      livenessLoopRef.current = requestAnimationFrame(tick);
    };
    livenessLoopRef.current = requestAnimationFrame(tick);
  }

  async function submitIdentify(staffId: number, photo: string, force = false, submitMode: CheckinMode = "checkin") {
    setCheckinStep("identifying");
    setChecklistBlock(null);
    try {
      const res = await fetch("/api/hr/face/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, photoBase64: photo, force, mode: submitMode }),
      });
      const text = await res.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      try { data = JSON.parse(text); }
      catch { setCheckinError(`Server error (${res.status})`); setCheckinStep("idle"); setCheckinTarget(null); return; }
      if (!res.ok) {
        if (data.checklistIncomplete) {
          setChecklistBlock({ doneCount: data.doneCount, totalCount: data.totalCount, canForce: data.canForce, staffId, photo });
          setCheckinStep("idle");
          stopCamera();
          return;
        }
        setCheckinError(data.error ?? "เช็คอินไม่สำเร็จ");
        setCheckinStep("idle");
        setCheckinTarget(null);
        return;
      }
      setResult(data);
      setCheckinStep("success");
      fetchStaff();
      setTimeout(() => {
        setCheckinStep("idle");
        setCheckinTarget(null);
        setResult(null);
      }, 4000);
    } catch (e) {
      setCheckinError(e instanceof Error ? e.message : "Network error");
      setCheckinStep("idle");
      setCheckinTarget(null);
    }
  }

  function resetCheckin() {
    stopCamera();
    setCheckinStep("idle");
    setCheckinTarget(null);
    setChallengeSequence([]);
    setChallengeIndex(0);
    setChallengeProgress("");
  }

  useEffect(() => {
    if (checkinStep !== "camera" || !checkinTarget || challengeSequence.length === 0) return;
    const id = setTimeout(() => {
      if (videoRef.current && streamRef.current) {
        startLivenessLoop(challengeSequence);
      }
    }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkinStep, checkinTarget, challengeSequence]);

  function pickStaffForCheckin(s: StaffMember) {
    if (!s.hasCredential) {
      setCheckinError(`${s.name} ยังไม่ได้ลงทะเบียนใบหน้า`);
      return;
    }
    if (!modelsReady) {
      setCheckinError("กำลังโหลดโมเดล รออีกสักครู่...");
      return;
    }
    setCheckinError("");
    setCheckinTarget(s);
    setChallengeSequence(pickChallengeSequence(CHALLENGES_PER_SCAN));
    setChallengeIndex(0);
    setCheckinStep("camera");
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex border-b border-white/10 px-4 py-3">
        <p className="text-sm font-bold text-[#fb8500]">เช็คอิน / เอาท์</p>
      </div>

      {checkinStep === "idle" && (
        <div className="flex-1 px-4 pt-6 pb-6 flex flex-col">

          {/* Mode selector */}
          {!mode && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <p className="text-[#f8f1e5]/50 text-sm mb-2">เลือกประเภท</p>
              <button
                onClick={() => { setMode("checkin"); setCheckinError(""); }}
                className="w-full bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-400 font-bold text-xl py-7 rounded-2xl active:scale-[0.97] transition-transform"
              >
                ☀️ เช็คอิน
              </button>
              <button
                onClick={() => { setMode("checkout"); setCheckinError(""); }}
                className="w-full bg-[#fb8500]/10 border-2 border-[#fb8500]/40 text-[#fb8500] font-bold text-xl py-7 rounded-2xl active:scale-[0.97] transition-transform"
              >
                🌙 เช็คเอาท์
              </button>
            </div>
          )}

          {/* Staff list (after mode is selected) */}
          {mode && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => { setMode(null); setCheckinError(""); }}
                  className="text-sm text-[#f8f1e5]/50 hover:text-[#f8f1e5]/80 transition-colors"
                >
                  ← กลับ
                </button>
                <span className={`text-sm font-bold ${mode === "checkin" ? "text-emerald-400" : "text-[#fb8500]"}`}>
                  {mode === "checkin" ? "☀️ เช็คอิน" : "🌙 เช็คเอาท์"}
                </span>
              </div>

              {checkinError && (
                <p className="text-red-400 text-sm text-center mb-4 bg-red-400/10 rounded-xl py-2 px-3">
                  {checkinError}
                </p>
              )}

              {!modelsReady && (
                <p className="text-[#f8f1e5]/40 text-xs text-center mb-3">
                  กำลังโหลดโมเดลตรวจจับใบหน้า...
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                {staff.map((s) => {
                  const disabledCheckin = mode === "checkin" && s.hasAttendanceToday;
                  const isDisabled = !s.hasCredential || disabledCheckin;
                  const statusLabel = !s.hasCredential
                    ? "ยังไม่ลงทะเบียน"
                    : mode === "checkin" && s.hasAttendanceToday
                    ? "เช็คอินแล้ว"
                    : s.isCheckedIn
                    ? "กำลังทำงาน"
                    : "ยังไม่เข้า";

                  return (
                    <button
                      key={s.id}
                      onClick={() => pickStaffForCheckin(s)}
                      disabled={isDisabled}
                      className={`bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3 transition-transform text-left ${
                        isDisabled ? "opacity-40" : "active:scale-95"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar s={s} size={12} />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#182a47] ${
                            s.isCheckedIn ? "bg-emerald-400" : "bg-white/20"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate">{s.name}</p>
                        <p className="text-[#f8f1e5]/50 text-xs">{statusLabel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {checkinStep === "camera" && checkinTarget && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-3">
          <p className="text-sm text-[#f8f1e5]/70">{checkinTarget.name}</p>

          <div className="flex gap-2">
            {challengeSequence.map((_, i) => (
              <span
                key={i}
                className={`w-3 h-3 rounded-full ${
                  i < challengeIndex
                    ? "bg-emerald-400"
                    : i === challengeIndex
                    ? "bg-[#fb8500] animate-pulse"
                    : "bg-white/20"
                }`}
              />
            ))}
          </div>

          <div
            className="relative rounded-full overflow-hidden border-4 border-[#fb8500] bg-black"
            style={{ width: "min(68vw, 68vh)", height: "min(68vw, 68vh)" }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          </div>

          <p className="text-xs text-[#f8f1e5]/50">
            ท่าที่ {challengeIndex + 1} / {challengeSequence.length}
          </p>
          <p className="text-xl font-bold text-center">
            {challengeSequence[challengeIndex] && CHALLENGE_LABEL[challengeSequence[challengeIndex]]}
          </p>
          {challengeProgress && (
            <p className="text-sm text-[#fb8500]">{challengeProgress}</p>
          )}
          <button
            onClick={resetCheckin}
            className="text-sm text-[#f8f1e5]/50 underline"
          >
            ยกเลิก
          </button>
        </div>
      )}

      {checkinStep === "identifying" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 border-4 border-[#fb8500] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#f8f1e5]/70">กำลังตรวจสอบตัวตน...</p>
        </div>
      )}

      {checklistBlock && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="text-5xl">🌙</div>
          <p className="text-xl font-bold text-[#fb8500]">เช็คลิสต์ปิดร้านยังไม่เสร็จ</p>
          <p className="text-[#f8f1e5]/60 text-sm">
            ทำแล้ว {checklistBlock.doneCount}/{checklistBlock.totalCount} รายการ<br/>
            ต้องทำให้ครบก่อนจึงจะเช็คเอาท์ได้
          </p>
          <button
            onClick={() => { setChecklistBlock(null); window.location.href = "/staff/checklist"; }}
            className="w-full bg-[#fb8500] text-white font-bold py-4 rounded-2xl text-base"
          >
            ไปทำเช็คลิสต์ปิดร้าน →
          </button>
          {checklistBlock.canForce && (
            <button
              onClick={() => { submitIdentify(checklistBlock.staffId, checklistBlock.photo, true, "checkout"); }}
              className="text-sm text-red-400 border border-red-400/30 px-4 py-2 rounded-xl"
            >
              บังคับออก (Owner เท่านั้น)
            </button>
          )}
          <button onClick={() => setChecklistBlock(null)} className="text-[#f8f1e5]/40 text-sm mt-1">
            ยกเลิก
          </button>
        </div>
      )}

      {checkinStep === "success" && result && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="text-5xl">
            {result.action === "checkin" ? "✅" : "👋"}
          </div>
          <p className="text-xl font-bold">
            {result.action === "checkin" ? "ยินดีต้อนรับ" : "ขอบคุณที่ทำงาน"}
          </p>
          <p className="text-2xl font-bold text-[#fb8500]">{result.staffName}</p>
          {result.status && (
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                result.status === "ON_TIME"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : result.status === "LATE"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-orange-500/20 text-orange-400"
              }`}
            >
              {result.status === "ON_TIME"
                ? "ตรงเวลา"
                : result.status === "LATE"
                ? "มาสาย"
                : "ออกก่อนเวลา"}
            </span>
          )}
          <p className="text-xs text-[#f8f1e5]/40">
            ความแม่นยำ {result.similarity.toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  );
}
