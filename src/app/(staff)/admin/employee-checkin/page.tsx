"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type Mode = "checkin" | "checkout";
type Phase = "scanning" | "aligning" | "submitting" | "success" | "error";

type Result = {
  action: "checkin" | "checkout";
  time: string;
  staffName: string;
  status: string | null;
  similarity: number;
};

type ChecklistBlock = {
  doneCount: number;
  totalCount: number;
  canForce: boolean;
  token: string;
  photo: string;
};

// Face step: the person must hold their face inside the oval for ~1s before we
// capture — (a) gives a steady, in-frame shot for a better match, (b) feels
// deliberate instead of snapping instantly the moment the QR is read.
const ALIGN_HOLD_MS = 1000;     // continuous in-frame time required before capture
const ALIGN_TICK_MS = 120;      // sampling cadence during the face step
const ALIGN_TIMEOUT_MS = 15000; // give up if no face shows up
const SKIN_MIN_RATIO = 0.12;    // fraction of the center box that must look like skin

// Passive liveness: a printed photo or a static screen barely changes
// frame-to-frame; a real person always has micro-motion during the hold.
const LIVENESS_MIN_MOTION = 1.2; // mean abs pixel diff (0–255) over the hold window
const LV_W = 64;
const LV_H = 48;

export default function EmployeeCheckinPage() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [phase, setPhase] = useState<Phase>("scanning");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [checklistBlock, setChecklistBlock] = useState<ChecklistBlock | null>(null);
  const [alignProgress, setAlignProgress] = useState(0); // 0–1 hold progress in step 2
  const [facePresent, setFacePresent] = useState(false); // face currently inside the oval

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const busyRef = useRef(false); // true while handling a detected QR
  const modeRef = useRef<Mode | null>(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  const cameraOn = mode !== null && (phase === "scanning" || phase === "aligning");

  // ── camera lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cameraOn) {
      stopCamera();
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        setError("เปิดกล้องไม่ได้");
        setPhase("error");
      });
    return () => stopCamera();
  }, [cameraOn]);

  function stopCamera() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function videoReady() {
    const v = videoRef.current;
    return !!v && v.readyState === 4 && v.videoWidth > 0;
  }

  // ── QR scanning loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "scanning" || !mode) return;
    busyRef.current = false;

    const canvas = scanCanvasRef.current ?? document.createElement("canvas");
    scanCanvasRef.current = canvas;

    const tick = () => {
      if (!busyRef.current && videoReady()) {
        const v = videoRef.current!;
        const w = 320;
        const h = Math.round((v.videoHeight / v.videoWidth) * w);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(v, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
        if (code && code.data) {
          busyRef.current = true;
          handleToken(code.data);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode]);

  // ── on QR found → wait for a steady face → capture → submit ─────────────────
  async function handleToken(token: string) {
    setError("");
    setAlignProgress(0);
    setFacePresent(false);
    setPhase("aligning");
    // brief pause so the person can lower the phone and look up at the camera
    await new Promise((r) => setTimeout(r, 600));

    const cap = await captureWhenSteady();
    if (!cap.ok) {
      setError(cap.error);
      setPhase("error");
      return;
    }
    await submit(token, cap.photo, false, modeRef.current ?? "checkin");
  }

  // Wait until a face sits inside the oval and is held steady for ALIGN_HOLD_MS,
  // confirming live micro-motion during the hold, then grab a full-res shot.
  async function captureWhenSteady(): Promise<
    { ok: true; photo: string } | { ok: false; error: string }
  > {
    const small = document.createElement("canvas");
    small.width = LV_W;
    small.height = LV_H;
    const sctx = small.getContext("2d", { willReadFrequently: true })!;

    let prev: Uint8ClampedArray | null = null;
    let heldMs = 0;
    let maxMotion = 0;
    const startedAt = Date.now();

    while (Date.now() - startedAt < ALIGN_TIMEOUT_MS) {
      if (videoReady()) {
        sctx.drawImage(videoRef.current!, 0, 0, LV_W, LV_H);
        const cur = sctx.getImageData(0, 0, LV_W, LV_H).data;
        const present = skinRatio(cur, LV_W, LV_H) >= SKIN_MIN_RATIO;

        // liveness runs continuously across every consecutive frame — a printed
        // photo / static screen stays near-identical no matter what.
        if (prev) {
          let sum = 0;
          for (let p = 0; p < cur.length; p += 4) {
            const g1 = (cur[p] + cur[p + 1] + cur[p + 2]) / 3;
            const g2 = (prev[p] + prev[p + 1] + prev[p + 2]) / 3;
            sum += Math.abs(g1 - g2);
          }
          maxMotion = Math.max(maxMotion, sum / (LV_W * LV_H));
        }
        prev = cur;

        if (present) {
          // gate: the face must sit inside the oval for the full hold before we
          // call it done and ship the shot to AWS.
          heldMs += ALIGN_TICK_MS;
          setFacePresent(true);
          setAlignProgress(Math.min(1, heldMs / ALIGN_HOLD_MS));
          if (heldMs >= ALIGN_HOLD_MS) {
            if (maxMotion < LIVENESS_MIN_MOTION) {
              return { ok: false, error: "ตรวจพบภาพนิ่ง — กรุณาให้คนจริงมองกล้อง" };
            }
            const photo = capturePhoto();
            if (!photo) return { ok: false, error: "จับภาพไม่สำเร็จ ลองใหม่อีกครั้ง" };
            return { ok: true, photo };
          }
        } else {
          // face left the frame — only the hold resets; liveness keeps accruing
          heldMs = 0;
          setFacePresent(false);
          setAlignProgress(0);
        }
      }
      await new Promise((r) => setTimeout(r, ALIGN_TICK_MS));
    }
    return { ok: false, error: "ไม่พบใบหน้าในกรอบ — ลองใหม่อีกครั้ง" };
  }

  // Rough skin-tone presence over the center box (the oval area). No ML needed:
  // an empty frame / wall scores ~0, a face fills a good fraction of the box.
  function skinRatio(data: Uint8ClampedArray, w: number, h: number): number {
    const x0 = Math.floor(w * 0.3), x1 = Math.ceil(w * 0.7);
    const y0 = Math.floor(h * 0.2), y1 = Math.ceil(h * 0.85);
    let skin = 0, total = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const p = (y * w + x) * 4;
        const r = data[p], g = data[p + 1], b = data[p + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (r > 95 && g > 40 && b > 20 && mx - mn > 15 && Math.abs(r - g) > 15 && r > g && r > b) skin++;
        total++;
      }
    }
    return total ? skin / total : 0;
  }

  function capturePhoto(): string | null {
    if (!videoReady()) return null;
    const v = videoRef.current!;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    return c.toDataURL("image/jpeg", 0.85);
  }

  async function submit(token: string, photo: string, force: boolean, submitMode: Mode) {
    setPhase("submitting");
    setChecklistBlock(null);
    try {
      const res = await fetch("/api/hr/face/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, photoBase64: photo, force, mode: submitMode }),
      });
      const data = await res.json().catch(() => null);
      if (!data) { setError(`Server error (${res.status})`); setPhase("error"); return; }
      if (!res.ok) {
        if (data.checklistIncomplete) {
          setChecklistBlock({
            doneCount: data.doneCount, totalCount: data.totalCount,
            canForce: data.canForce, token, photo,
          });
          setPhase("error");
          return;
        }
        setError(data.error ?? "เช็คอินไม่สำเร็จ");
        setPhase("error");
        return;
      }
      setResult(data);
      setPhase("success");
      setTimeout(() => resetToScan(), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setPhase("error");
    }
  }

  const resetToScan = useCallback(() => {
    setError("");
    setResult(null);
    setChecklistBlock(null);
    setAlignProgress(0);
    setFacePresent(false);
    busyRef.current = false;
    setPhase("scanning");
  }, []);

  // ── render ──────────────────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="max-w-md mx-auto py-8">
        <h1 className="text-xl font-bold text-navy text-center mb-2">เช็คอินพนักงาน</h1>
        <p className="text-center text-sm text-gray-500 mb-4">เลือกประเภทก่อน</p>
        <div className="mb-6 mx-auto max-w-xs text-sm text-gray-500 bg-sand/40 rounded-2xl px-4 py-3">
          <p className="font-bold text-navy mb-1">มี 2 ขั้นตอน</p>
          <p>1️⃣ ยื่น QR ในแอปให้กล้องสแกน</p>
          <p>2️⃣ เอามือถือลง มองกล้องเพื่อยืนยันใบหน้า</p>
        </div>
        <div className="flex flex-col gap-4">
          <button
            onClick={() => { setMode("checkin"); resetToScan(); }}
            className="w-full bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-600 font-bold text-xl py-7 rounded-2xl active:scale-[0.97] transition-transform"
          >
            ☀️ เช็คอิน
          </button>
          <button
            onClick={() => { setMode("checkout"); resetToScan(); }}
            className="w-full bg-orange/10 border-2 border-orange/40 text-orange font-bold text-xl py-7 rounded-2xl active:scale-[0.97] transition-transform"
          >
            🌙 เช็คเอาท์
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-4 flex flex-col items-center gap-4">
      <div className="w-full flex items-center gap-3">
        <button onClick={() => setMode(null)} className="text-sm text-gray-500 hover:text-navy">← กลับ</button>
        <span className={`text-sm font-bold ${mode === "checkin" ? "text-emerald-600" : "text-orange"}`}>
          {mode === "checkin" ? "☀️ เช็คอิน" : "🌙 เช็คเอาท์"}
        </span>
      </div>

      {/* Camera always mounted while scanning/aligning so the stream stays attached */}
      {(phase === "scanning" || phase === "aligning") && (
        <>
          {/* Step progress: 1 สแกน QR → 2 ยืนยันใบหน้า */}
          <div className="w-full flex items-center gap-2">
            <StepPill n={1} label="สแกน QR" active={phase === "scanning"} done={phase === "aligning"} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${phase === "aligning" ? "bg-emerald-400" : "bg-gray-200"}`} />
            <StepPill n={2} label="ยืนยันใบหน้า" active={phase === "aligning"} done={false} />
          </div>

          <div className={`relative rounded-3xl overflow-hidden border-4 bg-black w-full aspect-[4/3] transition-colors ${
            phase === "scanning" ? "border-navy" : facePresent ? "border-emerald-400" : "border-yellow-400"
          }`}>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {phase === "scanning" ? (
                // square reticle = "วาง QR ตรงนี้"
                <div className="w-48 h-48 rounded-2xl border-2 border-white/40 relative">
                  <span className="absolute -top-0.5 -left-0.5 w-7 h-7 border-t-4 border-l-4 border-orange rounded-tl-2xl" />
                  <span className="absolute -top-0.5 -right-0.5 w-7 h-7 border-t-4 border-r-4 border-orange rounded-tr-2xl" />
                  <span className="absolute -bottom-0.5 -left-0.5 w-7 h-7 border-b-4 border-l-4 border-orange rounded-bl-2xl" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-7 h-7 border-b-4 border-r-4 border-orange rounded-br-2xl" />
                </div>
              ) : (
                // face oval = "วางหน้าตรงนี้" — turns green once a face is held
                <div className={`w-40 h-52 border-4 rounded-[50%] transition-colors ${
                  facePresent ? "border-emerald-300" : "border-white/60"
                }`} />
              )}
            </div>
          </div>

          {/* Hold progress bar (step 2) — fills as the face stays in the oval */}
          {phase === "aligning" && (
            <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-150"
                style={{ width: `${Math.round(alignProgress * 100)}%` }}
              />
            </div>
          )}

          <div className="text-center">
            <p className="text-base font-bold text-navy">
              {phase === "scanning"
                ? "ขั้นที่ 1 · ยื่น QR ให้กล้องสแกน"
                : facePresent
                  ? "ขั้นที่ 2 · นิ่งไว้… กำลังยืนยัน"
                  : "ขั้นที่ 2 · วางใบหน้าให้อยู่ในกรอบ"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {phase === "scanning"
                ? "เปิดหน้า “QR เช็คอินของฉัน” ในมือถือพนักงาน"
                : facePresent
                  ? "มองกล้องตรง ๆ ค้างไว้สักครู่"
                  : "เอามือถือลง แล้วเลื่อนหน้าให้อยู่กลางวงรี"}
            </p>
          </div>
        </>
      )}

      {phase === "submitting" && (
        <div className="py-16 flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 border-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">กำลังตรวจสอบตัวตน…</p>
        </div>
      )}

      {phase === "success" && result && (
        <div className="py-10 flex flex-col items-center gap-3 text-center">
          <div className="text-6xl">{result.action === "checkin" ? "✅" : "👋"}</div>
          <p className="text-lg font-semibold text-gray-600">
            {result.action === "checkin" ? "ยินดีต้อนรับ" : "ขอบคุณที่ทำงาน"}
          </p>
          <p className="text-2xl font-bold text-orange">{result.staffName}</p>
          {result.status && (
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
              result.status === "ON_TIME" ? "bg-emerald-100 text-emerald-700"
              : result.status === "LATE" ? "bg-yellow-100 text-yellow-700"
              : "bg-orange-100 text-orange-700"
            }`}>
              {result.status === "ON_TIME" ? "ตรงเวลา" : result.status === "LATE" ? "มาสาย" : "ออกก่อนเวลา"}
            </span>
          )}
          <p className="text-xs text-gray-400">ความแม่นยำ {result.similarity.toFixed(1)}%</p>
        </div>
      )}

      {phase === "error" && checklistBlock && (
        <div className="py-8 flex flex-col items-center gap-4 text-center px-4">
          <div className="text-5xl">🌙</div>
          <p className="text-lg font-bold text-orange">เช็คลิสต์ปิดร้านยังไม่เสร็จ</p>
          <p className="text-gray-500 text-sm">
            ทำแล้ว {checklistBlock.doneCount}/{checklistBlock.totalCount} รายการ — ต้องครบก่อนจึงเช็คเอาท์ได้
          </p>
          {checklistBlock.canForce && (
            <button
              onClick={() => submit(checklistBlock.token, checklistBlock.photo, true, "checkout")}
              className="text-sm text-red-500 border border-red-300 px-4 py-2 rounded-xl"
            >
              บังคับออก (Owner เท่านั้น)
            </button>
          )}
          <button onClick={resetToScan} className="text-sm text-gray-400 underline">สแกนใหม่</button>
        </div>
      )}

      {phase === "error" && !checklistBlock && (
        <div className="py-10 flex flex-col items-center gap-4 text-center px-4">
          <div className="text-5xl">⚠️</div>
          <p className="text-red-500 font-semibold">{error}</p>
          <button
            onClick={resetToScan}
            className="bg-navy text-white font-bold px-6 py-3 rounded-xl active:scale-95 transition-transform"
          >
            สแกนใหม่
          </button>
        </div>
      )}
    </div>
  );
}

function StepPill({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-colors ${
      active ? "border-orange bg-orange/10 text-orange"
      : done ? "border-emerald-400 bg-emerald-50 text-emerald-600"
      : "border-gray-200 bg-gray-50 text-gray-400"
    }`}>
      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold ${
        active ? "bg-orange text-white"
        : done ? "bg-emerald-400 text-white"
        : "bg-gray-200 text-gray-500"
      }`}>
        {done ? "✓" : n}
      </span>
      <span className="text-sm font-bold whitespace-nowrap">{label}</span>
    </div>
  );
}
