"use client";

import { useState, useRef, useCallback } from "react";

const TARGET_TAPS = 20;

export default function SpeedTap() {
  const [phase, setPhase] = useState<"idle" | "ready" | "go" | "done">("idle");
  const [taps, setTaps] = useState(0);
  const [ms, setMs] = useState<number | null>(null);
  const startRef = useRef<number>(0);

  const start = useCallback(() => {
    setPhase("ready");
    setTaps(0);
    setMs(null);
    const delay = 1500 + Math.random() * 2000;
    setTimeout(() => {
      startRef.current = Date.now();
      setPhase("go");
    }, delay);
  }, []);

  const handleTap = useCallback(() => {
    if (phase !== "go") return;
    setTaps((t) => {
      const next = t + 1;
      if (next >= TARGET_TAPS) {
        const elapsed = Date.now() - startRef.current;
        setMs(elapsed);
        setPhase("done");
      }
      return next;
    });
  }, [phase]);

  const rating = ms
    ? ms < 3000 ? { label: "เร็วสุดๆ! ⚡", color: "text-orange" }
    : ms < 5000 ? { label: "เร็วมาก 🔥", color: "text-yellow-500" }
    : ms < 8000 ? { label: "พอใช้ 👍", color: "text-sage" }
    : { label: "ช้าหน่อยนะ 🐢", color: "text-gray-400" }
    : null;

  return (
    <div className="text-center">
      {phase === "idle" && (
        <>
          <p className="text-gray-500 text-sm mb-6">กด {TARGET_TAPS} ครั้งให้เร็วที่สุด!</p>
          <button onClick={start} className="w-full bg-orange text-white font-bold py-4 rounded-xl text-lg">
            ⚡ เริ่มเลย!
          </button>
        </>
      )}

      {phase === "ready" && (
        <div className="py-8">
          <p className="text-4xl font-bold text-navy animate-pulse">รอสัญญาณ...</p>
          <p className="text-gray-400 text-sm mt-2">อย่ากดก่อน!</p>
        </div>
      )}

      {phase === "go" && (
        <>
          <div className="mb-4">
            <div className="w-full bg-sand rounded-full h-3 mb-2">
              <div
                className="bg-orange h-3 rounded-full transition-all"
                style={{ width: `${(taps / TARGET_TAPS) * 100}%` }}
              />
            </div>
            <p className="text-sm text-gray-400">{taps} / {TARGET_TAPS} ครั้ง</p>
          </div>
          <button
            onPointerDown={handleTap}
            className="w-full h-48 bg-orange text-white font-bold text-2xl rounded-2xl active:scale-95 transition-transform select-none touch-none"
          >
            👆 TAP!
          </button>
        </>
      )}

      {phase === "done" && ms && (
        <>
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
            <p className="text-gray-400 text-sm mb-1">เวลาที่ใช้</p>
            <p className="text-4xl font-bold text-navy">{(ms / 1000).toFixed(2)}<span className="text-lg"> วิ</span></p>
            <p className={`text-xl font-bold mt-2 ${rating?.color}`}>{rating?.label}</p>
          </div>
          <button onClick={start} className="w-full bg-navy text-cream font-bold py-3 rounded-xl">
            🔄 เล่นอีกครั้ง
          </button>
        </>
      )}
    </div>
  );
}
