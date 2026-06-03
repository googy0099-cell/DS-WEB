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
  hasCredential: boolean;
};

type Tab = "checkin" | "register";
type CheckinStep = "idle" | "pickStaff" | "camera" | "identifying" | "success";
type RegisterStep = "pick" | "camera" | "saving" | "done";

type ChallengeType = "blink" | "mouth" | "left" | "right";
const CHALLENGE_LABEL: Record<ChallengeType, string> = {
  blink: "กระพริบตา 2 ครั้ง",
  mouth: "อ้าปากกว้างค้างไว้",
  left: "หันหน้าไปทางซ้าย",
  right: "หันหน้าไปทางขวา",
};
const CHALLENGES: ChallengeType[] = ["blink", "mouth", "left", "right"];

const LIVENESS_TIMEOUT_MS = 15000;
const DETECT_INTERVAL_MS = 150;

function pickChallenge(): ChallengeType {
  return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
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
  const [tab, setTab] = useState<Tab>("checkin");
  const [modelsReady, setModelsReady] = useState(false);

  // check-in state
  const [checkinStep, setCheckinStep] = useState<CheckinStep>("idle");
  const [checkinTarget, setCheckinTarget] = useState<StaffMember | null>(null);
  const [challenge, setChallenge] = useState<ChallengeType>("blink");
  const [challengeProgress, setChallengeProgress] = useState(""); // shown to user
  const [checkinError, setCheckinError] = useState("");
  const [result, setResult] = useState<{
    action: "checkin" | "checkout";
    time: string;
    staffName: string;
    status: string | null;
    similarity: number;
  } | null>(null);

  // register state
  const [regStep, setRegStep] = useState<RegisterStep>("pick");
  const [regTarget, setRegTarget] = useState<StaffMember | null>(null);
  const [regMsg, setRegMsg] = useState("");
  const [regCountdown, setRegCountdown] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const livenessLoopRef = useRef<number | null>(null);
  const livenessStartRef = useRef<number>(0);
  const blinkStateRef = useRef<BlinkState>({ eyesOpen: true, blinkCount: 0 });
  const holdStartRef = useRef<number | null>(null); // for mouth/yaw hold time

  // ── data ──────────────────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    const res = await fetch("/api/hr/staff");
    if (res.ok) setStaff(await res.json());
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Load face-api models in background
  useEffect(() => {
    loadModels()
      .then(() => setModelsReady(true))
      .catch(() => setModelsReady(false));
  }, []);

  // ── camera ────────────────────────────────────────────────────────────────

  const needsCamera =
    (tab === "checkin" && checkinStep === "camera") ||
    (tab === "register" && regStep === "camera");

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
        if (tab === "checkin") {
          resetCheckin();
          setCheckinError("เปิดกล้องไม่ได้");
        }
        if (tab === "register") {
          resetRegister();
          setRegMsg("เปิดกล้องไม่ได้");
        }
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
        setChallengeProgress(`กระพริบแล้ว ${blinkStateRef.current.blinkCount}/2 ครั้ง`);
        return blinkStateRef.current.blinkCount >= 2;
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

  function startLivenessLoop(ch: ChallengeType) {
    livenessStartRef.current = performance.now();
    blinkStateRef.current = { eyesOpen: true, blinkCount: 0 };
    holdStartRef.current = null;
    setChallengeProgress("");

    let lastDetect = 0;

    const tick = async () => {
      const now = performance.now();

      if (now - livenessStartRef.current > LIVENESS_TIMEOUT_MS) {
        stopCamera();
        setCheckinError("หมดเวลา ลองใหม่อีกครั้ง");
        setCheckinStep("idle");
        setCheckinTarget(null);
        return;
      }

      if (now - lastDetect >= DETECT_INTERVAL_MS && videoRef.current && videoRef.current.readyState === 4) {
        lastDetect = now;
        try {
          const m = await detectMetrics(videoRef.current);
          if (m) {
            const passed = checkChallengeMet(m, ch, now);
            if (passed) {
              // Capture and submit
              const photo = capturePhoto();
              stopCamera();
              if (!photo || !checkinTarget) {
                setCheckinError("จับภาพไม่ได้");
                setCheckinStep("idle");
                setCheckinTarget(null);
                return;
              }
              await submitIdentify(checkinTarget.id, photo);
              return;
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

  async function submitIdentify(staffId: number, photo: string) {
    setCheckinStep("identifying");
    try {
      const res = await fetch("/api/hr/face/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, photoBase64: photo }),
      });
      const data = await res.json();
      if (!res.ok) {
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
    setChallengeProgress("");
  }

  // Trigger liveness when camera opens with a target
  useEffect(() => {
    if (checkinStep !== "camera" || !checkinTarget) return;
    const id = setTimeout(() => {
      if (videoRef.current && streamRef.current) {
        startLivenessLoop(challenge);
      }
    }, 800); // wait for video to start playing
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkinStep, checkinTarget, challenge]);

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
    setChallenge(pickChallenge());
    setCheckinStep("camera");
  }

  // ── register flow (1 photo) ───────────────────────────────────────────────

  function resetRegister() {
    stopCamera();
    setRegStep("pick");
    setRegTarget(null);
    setRegMsg("");
    setRegCountdown(0);
  }

  // countdown 3..2..1 then capture
  useEffect(() => {
    if (regStep !== "camera" || !regTarget) return;
    setRegCountdown(3);
    const tick = (n: number) => {
      if (n === 0) {
        captureAndRegister();
        return;
      }
      setRegCountdown(n);
      setTimeout(() => tick(n - 1), 1000);
    };
    const id = setTimeout(() => tick(3), 800); // start after camera warmup
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regStep, regTarget]);

  async function captureAndRegister() {
    const photo = capturePhoto();
    stopCamera();
    if (!photo || !regTarget) {
      setRegMsg("จับภาพไม่ได้");
      setRegStep("pick");
      setRegTarget(null);
      return;
    }
    setRegStep("saving");
    setRegMsg("กำลังบันทึก...");
    try {
      const res = await fetch("/api/hr/face/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: regTarget.id, photo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegMsg(data.error ?? "บันทึกไม่สำเร็จ");
        setRegStep("pick");
        return;
      }
      setRegMsg(`ลงทะเบียน ${regTarget.name} สำเร็จ`);
      setRegStep("done");
      fetchStaff();
      setTimeout(() => resetRegister(), 2500);
    } catch (e) {
      setRegMsg(e instanceof Error ? e.message : "Network error");
      setRegStep("pick");
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex border-b border-white/10">
        {(["checkin", "register"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              resetCheckin();
              resetRegister();
              setTab(t);
            }}
            className={`flex-1 py-3 text-sm font-bold ${
              tab === t ? "text-[#fb8500] border-b-2 border-[#fb8500]" : "text-[#f8f1e5]/50"
            }`}
          >
            {t === "checkin" ? "เช็คอิน / เอาท์" : "ลงทะเบียนหน้า"}
          </button>
        ))}
      </div>

      {/* ── TAB: เช็คอิน ───────────────────────────────────────────── */}
      {tab === "checkin" && (
        <>
          {checkinStep === "idle" && (
            <div className="flex-1 px-4 pt-6 pb-6 flex flex-col">
              <p className="text-center mb-4 text-[#f8f1e5]/70 text-sm">
                เลือกชื่อตัวเองเพื่อเช็คอิน/เอาท์
              </p>

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
                {staff.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => pickStaffForCheckin(s)}
                    disabled={!s.hasCredential}
                    className={`bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3 transition-transform text-left ${
                      s.hasCredential ? "active:scale-95" : "opacity-40"
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
                      <p className="text-[#f8f1e5]/50 text-xs">
                        {!s.hasCredential
                          ? "ยังไม่ลงทะเบียน"
                          : s.isCheckedIn
                          ? "กำลังทำงาน"
                          : "ยังไม่เข้า"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {checkinStep === "camera" && checkinTarget && (
            <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
              <p className="text-sm text-[#f8f1e5]/70">
                {checkinTarget.name}
              </p>
              <div
                className="relative rounded-full overflow-hidden border-4 border-[#fb8500] bg-black"
                style={{ width: "min(72vw, 72vh)", height: "min(72vw, 72vh)" }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              </div>
              <p className="text-xl font-bold text-center">{CHALLENGE_LABEL[challenge]}</p>
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
        </>
      )}

      {/* ── TAB: ลงทะเบียน ──────────────────────────────────────────── */}
      {tab === "register" && (
        <>
          {regStep === "pick" && (
            <div className="flex-1 px-4 pt-6 pb-6">
              <p className="text-center mb-4 text-[#f8f1e5]/70 text-sm">
                เลือกพนักงานที่จะลงทะเบียนใบหน้า
              </p>

              {regMsg && (
                <p className="text-red-400 text-sm text-center mb-4 bg-red-400/10 rounded-xl py-2 px-3">
                  {regMsg}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                {staff.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setRegTarget(s);
                      setRegMsg("");
                      setRegStep("camera");
                    }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3 active:scale-95 transition-transform text-left"
                  >
                    <Avatar s={s} size={12} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{s.name}</p>
                      <p className="text-[#f8f1e5]/50 text-xs">
                        {s.hasCredential ? "ลงทะเบียนแล้ว (ลงใหม่ทับได้)" : "ยังไม่ลงทะเบียน"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {regStep === "camera" && regTarget && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
              <p className="text-sm text-[#f8f1e5]/70">{regTarget.name}</p>
              <div
                className="relative rounded-full overflow-hidden border-4 border-[#fb8500] bg-black"
                style={{ width: "min(72vw, 72vh)", height: "min(72vw, 72vh)" }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {regCountdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-8xl font-bold text-[#fb8500] drop-shadow-lg">
                      {regCountdown}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-lg font-bold">มองตรงๆ ที่กล้อง</p>
              <button
                onClick={resetRegister}
                className="text-sm text-[#f8f1e5]/50 underline"
              >
                ยกเลิก
              </button>
            </div>
          )}

          {regStep === "saving" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 border-4 border-[#fb8500] border-t-transparent rounded-full animate-spin" />
              <p className="text-[#f8f1e5]/60 text-sm">{regMsg}</p>
            </div>
          )}

          {regStep === "done" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
              <div className="text-5xl">✅</div>
              <p className="font-bold text-lg">{regMsg}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
