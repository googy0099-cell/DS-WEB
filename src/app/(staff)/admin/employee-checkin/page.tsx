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

// Face step: a real, frontal face must be centred and filling the oval before
// we capture — bank-app style, not "a cheek touched the frame". When the
// browser exposes the native FaceDetector (Chrome on Android, the shop kiosk)
// we check the face box geometry + eye/nose landmarks; otherwise we fall back
// to a stricter skin heuristic.
const FRAME_HOLD_MS = 450;      // hold a good frontal face this long before the turn challenge
const BACK_HOLD_MS = 450;       // hold frontal again after the turn, right before capture
const TURN_MIN = 0.22;          // |nose-offset / face width| that counts as "turned to the side"
const FRONTAL_BACK_MAX = 0.13;  // |nose-offset| considered "looking straight again"
const ALIGN_TIMEOUT_MS = 22000; // give up if the whole step isn't completed in time

// Face-box geometry, as fractions of the camera frame (face must fill the oval)
const FACE_MIN_H = 0.42;        // too small → "ขยับเข้าใกล้"
const FACE_MAX_H = 0.95;        // too big   → "ถอยห่าง"
const FACE_MIN_W = 0.26;
const FACE_MAX_W = 0.80;
const FACE_CENTER_DX = 0.16;    // |centreX-0.5| allowed
const FACE_CENTER_DY = 0.18;    // |centreY-0.5| allowed
const EYE_SPAN_MIN = 0.26;      // eyeDist / faceWidth — lower = turned sideways
const NOSE_OFFSET_MAX = 0.22;   // |noseX - eyeMidX| / faceWidth — higher = turned

// Fallback heuristic (no FaceDetector): a centred face has lots of skin in the
// middle box and little at the side strips.
const SKIN_CENTER_MIN = 0.38;   // center box must be mostly face
const SKIN_EDGE_MAX = 0.20;     // side strips must be mostly background

// Passive liveness: a printed photo or a static screen barely changes
// frame-to-frame; a real person always has micro-motion during the hold.
const LIVENESS_MIN_MOTION = 1.2; // mean abs pixel diff (0–255) over the hold window
const LV_W = 64;
const LV_H = 48;

// Minimal typings for the Shape Detection API (not in the TS DOM lib yet).
type FaceLandmark = { type: string; locations: { x: number; y: number }[] };
type DetectedFace = { boundingBox: { x: number; y: number; width: number; height: number }; landmarks?: FaceLandmark[] };
type FaceDetectorLike = { detect(src: CanvasImageSource): Promise<DetectedFace[]> };
type FaceDetectorCtor = new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;

export default function EmployeeCheckinPage() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [phase, setPhase] = useState<Phase>("scanning");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [checklistBlock, setChecklistBlock] = useState<ChecklistBlock | null>(null);
  const [alignProgress, setAlignProgress] = useState(0); // 0–1 hold progress in step 2
  const [facePresent, setFacePresent] = useState(false); // a valid frontal face is held
  const [faceHint, setFaceHint] = useState("จัดใบหน้าให้เต็มวงรี"); // guidance during step 2
  const [faceStage, setFaceStage] = useState<"frame" | "turn" | "back">("frame"); // liveness challenge stage

  const detectorRef = useRef<FaceDetectorLike | null>(null);
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
    setFaceStage("frame");
    setFaceHint("จัดใบหน้าให้เต็มวงรี");
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

  // Lazily build the native face detector (Chrome on Android). null if absent.
  function getDetector(): FaceDetectorLike | null {
    if (detectorRef.current) return detectorRef.current;
    const Ctor = (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
    if (!Ctor) return null;
    try { detectorRef.current = new Ctor({ fastMode: false, maxDetectedFaces: 2 }); }
    catch { detectorRef.current = null; }
    return detectorRef.current;
  }

  type FaceCheck = { ok: boolean; hint: string };
  type FaceMetrics = { cx: number; cy: number; fw: number; fh: number; noseOffset: number | null; eyeSpan: number | null };

  function faceMetrics(face: DetectedFace, W: number, H: number): FaceMetrics {
    const box = face.boundingBox;
    const cx = (box.x + box.width / 2) / W;
    const cy = (box.y + box.height / 2) / H;
    const fw = box.width / W;
    const fh = box.height / H;
    let noseOffset: number | null = null;
    let eyeSpan: number | null = null;
    const lm = face.landmarks;
    if (lm && lm.length) {
      const eyes = lm.filter((l) => l.type === "eye").map((l) => l.locations[0]).filter(Boolean);
      const nose = lm.find((l) => l.type === "nose")?.locations[0];
      if (eyes.length >= 2) {
        const [e1, e2] = eyes;
        eyeSpan = Math.abs(e1.x - e2.x) / box.width;
        if (nose) noseOffset = (nose.x - (e1.x + e2.x) / 2) / box.width;
      }
    }
    return { cx, cy, fw, fh, noseOffset, eyeSpan };
  }

  // Geometry gate: centred, filling the oval, and frontal (eyes apart, nose between).
  function checkFramed(m: FaceMetrics): FaceCheck {
    if (Math.abs(m.cx - 0.5) > FACE_CENTER_DX || Math.abs(m.cy - 0.5) > FACE_CENTER_DY)
      return { ok: false, hint: "จัดใบหน้าให้อยู่กลางวงรี" };
    if (m.fh < FACE_MIN_H || m.fw < FACE_MIN_W) return { ok: false, hint: "ขยับเข้าใกล้กล้องอีกนิด" };
    if (m.fh > FACE_MAX_H || m.fw > FACE_MAX_W) return { ok: false, hint: "ถอยห่างจากกล้องเล็กน้อย" };
    if (m.eyeSpan != null && m.eyeSpan < EYE_SPAN_MIN) return { ok: false, hint: "หันหน้าตรงเข้ากล้อง" };
    if (m.noseOffset != null && Math.abs(m.noseOffset) > NOSE_OFFSET_MAX) return { ok: false, hint: "หันหน้าตรงเข้ากล้อง" };
    return { ok: true, hint: "นิ่งไว้สักครู่…" };
  }

  function finishCapture(maxMotion: number): { ok: true; photo: string } | { ok: false; error: string } {
    if (maxMotion < LIVENESS_MIN_MOTION) return { ok: false, error: "ตรวจพบภาพนิ่ง — กรุณาให้คนจริงมองกล้อง" };
    const photo = capturePhoto();
    if (!photo) return { ok: false, error: "จับภาพไม่สำเร็จ ลองใหม่อีกครั้ง" };
    return { ok: true, photo };
  }

  const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

  // Step 2: frame a frontal face → ask for ONE head turn (a live 3D head can do
  // it; a flat photo/screen can't) → look straight again → capture & send to AWS.
  // Liveness micro-motion runs throughout as a cheap extra. Degrades gracefully:
  // no landmarks → skip the turn (hold frontal); no FaceDetector → skin gate.
  async function captureWhenSteady(): Promise<
    { ok: true; photo: string } | { ok: false; error: string }
  > {
    const detector = getDetector();
    const small = document.createElement("canvas");
    small.width = LV_W;
    small.height = LV_H;
    const sctx = small.getContext("2d", { willReadFrequently: true })!;

    let prev: Uint8ClampedArray | null = null;
    let maxMotion = 0;
    let stage: "frame" | "turn" | "back" = "frame";
    let framedMs = 0, backMs = 0;
    let sawLandmarks = false;
    let last = Date.now();
    const startedAt = last;
    setFaceStage("frame");

    while (Date.now() - startedAt < ALIGN_TIMEOUT_MS) {
      const now = Date.now();
      const dt = now - last;
      last = now;

      if (videoReady()) {
        // continuous liveness — a static screen barely changes frame-to-frame
        sctx.drawImage(videoRef.current!, 0, 0, LV_W, LV_H);
        const cur = sctx.getImageData(0, 0, LV_W, LV_H).data;
        if (prev) {
          let sum = 0;
          for (let p = 0; p < cur.length; p += 4) {
            sum += Math.abs((cur[p] + cur[p + 1] + cur[p + 2]) / 3 - (prev[p] + prev[p + 1] + prev[p + 2]) / 3);
          }
          maxMotion = Math.max(maxMotion, sum / (LV_W * LV_H));
        }
        prev = cur;

        // No native detector → stricter skin gate, plain frontal hold (no turn)
        if (!detector) {
          const c = skinFallback(cur);
          setFaceHint(c.hint);
          if (c.ok) {
            framedMs += dt; setFacePresent(true);
            setAlignProgress(Math.min(1, framedMs / (FRAME_HOLD_MS + BACK_HOLD_MS)));
            if (framedMs >= FRAME_HOLD_MS + BACK_HOLD_MS) return finishCapture(maxMotion);
          } else { framedMs = 0; setFacePresent(false); setAlignProgress(0); }
          await nextFrame();
          continue;
        }

        const v = videoRef.current!;
        let faces: DetectedFace[] = [];
        try { faces = await detector.detect(v); } catch { faces = []; }

        if (faces.length === 0) {
          setFacePresent(false);
          setFaceHint("ไม่พบใบหน้า — มองกล้องตรง ๆ");
          if (stage !== "turn") { framedMs = 0; backMs = 0; setAlignProgress(0); }
          await nextFrame();
          continue;
        }
        if (faces.length > 1) {
          setFacePresent(false);
          setFaceHint("พบหลายใบหน้า — ให้เหลือคนเดียว");
          await nextFrame();
          continue;
        }

        const m = faceMetrics(faces[0], v.videoWidth, v.videoHeight);
        if (m.noseOffset != null) sawLandmarks = true;

        if (stage === "frame") {
          const c = checkFramed(m);
          setFaceHint(c.ok ? "จับใบหน้าได้แล้ว…" : c.hint);
          if (c.ok) {
            framedMs += dt; setFacePresent(true);
            setAlignProgress(Math.min(0.34, (0.34 * framedMs) / FRAME_HOLD_MS));
            if (framedMs >= FRAME_HOLD_MS) {
              if (sawLandmarks) {
                stage = "turn"; setFaceStage("turn"); setAlignProgress(0.34);
                setFaceHint("หันหน้าไปด้านข้างช้า ๆ");
              } else if (framedMs >= FRAME_HOLD_MS + BACK_HOLD_MS) {
                // engine never gave landmarks → can't challenge; hold then capture
                return finishCapture(maxMotion);
              }
            }
          } else { framedMs = 0; setFacePresent(false); setAlignProgress(0); }
        } else if (stage === "turn") {
          setFacePresent(true);
          setFaceHint("หันหน้าไปด้านข้างช้า ๆ");
          if (m.noseOffset != null && Math.abs(m.noseOffset) >= TURN_MIN) {
            stage = "back"; setFaceStage("back"); backMs = 0;
            setAlignProgress(0.67); setFaceHint("เยี่ยม! มองกล้องตรง ๆ");
          }
        } else {
          const c = checkFramed(m);
          const straight = c.ok && (m.noseOffset == null || Math.abs(m.noseOffset) <= FRONTAL_BACK_MAX);
          setFaceHint(straight ? "มองกล้องตรง ๆ ค้างไว้…" : "มองกล้องตรง ๆ");
          if (straight) {
            backMs += dt;
            setAlignProgress(0.67 + 0.33 * Math.min(1, backMs / BACK_HOLD_MS));
            if (backMs >= BACK_HOLD_MS) return finishCapture(maxMotion);
          } else backMs = 0;
        }
      }
      await nextFrame();
    }
    return { ok: false, error: "ยืนยันใบหน้าไม่สำเร็จ — ลองใหม่อีกครั้ง" };
  }

  // Fallback (no FaceDetector): centre box mostly skin, side strips mostly not —
  // so a partial cheek at the edge or a sideways face won't pass.
  function skinFallback(data: Uint8ClampedArray): FaceCheck {
    const isSkin = (p: number) => {
      const r = data[p], g = data[p + 1], b = data[p + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      return r > 95 && g > 40 && b > 20 && mx - mn > 15 && Math.abs(r - g) > 15 && r > g && r > b;
    };
    const ratio = (x0f: number, x1f: number) => {
      const x0 = Math.floor(LV_W * x0f), x1 = Math.ceil(LV_W * x1f);
      const y0 = Math.floor(LV_H * 0.18), y1 = Math.ceil(LV_H * 0.9);
      let skin = 0, total = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        if (isSkin((y * LV_W + x) * 4)) skin++;
        total++;
      }
      return total ? skin / total : 0;
    };
    const center = ratio(0.32, 0.68);
    const edges = Math.max(ratio(0, 0.18), ratio(0.82, 1));
    if (center < SKIN_CENTER_MIN) return { ok: false, hint: "จัดใบหน้าให้เต็มวงรี" };
    if (edges > SKIN_EDGE_MAX) return { ok: false, hint: "จัดใบหน้าให้อยู่กลางวงรี" };
    return { ok: true, hint: "นิ่งไว้… กำลังยืนยัน" };
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
    setFaceStage("frame");
    setFaceHint("จัดใบหน้าให้เต็มวงรี");
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
            phase === "scanning" ? "border-navy"
            : faceStage === "turn" ? "border-sky-400"
            : facePresent ? "border-emerald-400" : "border-yellow-400"
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
                // face oval = "วางหน้าตรงนี้" — turns green once a face is held;
                // during the turn challenge, show a side-to-side arrow cue.
                <div className="relative flex items-center justify-center">
                  <div className={`w-40 h-52 border-4 rounded-[50%] transition-colors ${
                    faceStage === "turn" ? "border-sky-300 animate-pulse"
                    : facePresent ? "border-emerald-300" : "border-white/60"
                  }`} />
                  {faceStage === "turn" && (
                    <span className="absolute text-4xl text-sky-200 animate-pulse">↔️</span>
                  )}
                </div>
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
              {phase === "scanning" ? "ขั้นที่ 1 · ยื่น QR ให้กล้องสแกน" : "ขั้นที่ 2 · ยืนยันใบหน้า"}
            </p>
            <p className={`text-sm mt-1 font-medium ${
              phase !== "aligning" ? "text-gray-500"
              : faceStage === "turn" ? "text-sky-600"
              : facePresent ? "text-emerald-600" : "text-orange"
            }`}>
              {phase === "scanning"
                ? "เปิดหน้า “QR เช็คอินของฉัน” ในมือถือพนักงาน"
                : faceHint}
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
