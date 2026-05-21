"use client";

import { useState } from "react";

const RESULTS = [
  { label: "ดวงเฮง! ⭐", desc: "วันนี้โชคดีมาก", color: "text-yellow-500" },
  { label: "แข็งแกร่ง 💪", desc: "ใจสู้ไม่แพ้ใคร", color: "text-orange" },
  { label: "โชคดี 🍀", desc: "มีโชคลาภรออยู่", color: "text-sage" },
  { label: "ระวังหน่อย 🌧️", desc: "วันนี้ใจเย็นๆ ไว้", color: "text-blue-400" },
  { label: "เฮงสุดๆ 🎉", desc: "วันนี้ดีทุกอย่าง!", color: "text-pink-500" },
  { label: "ต้องสู้ต่อ 🔥", desc: "อย่าท้อ สู้ไป!", color: "text-red-500" },
  { label: "สมหวัง 🌟", desc: "ความปรารถนาจะสมหวัง", color: "text-purple-500" },
  { label: "เงียบๆ ก็ดี 🌙", desc: "วันพักผ่อน ไม่ต้องรีบ", color: "text-indigo-400" },
];

export default function LuckyDraw() {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<typeof RESULTS[0] | null>(null);
  const [rotation, setRotation] = useState(0);

  function spin() {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    const extra = 1440 + Math.floor(Math.random() * 360);
    setRotation((r) => r + extra);
    setTimeout(() => {
      const picked = RESULTS[Math.floor(Math.random() * RESULTS.length)];
      setResult(picked);
      setSpinning(false);
    }, 2000);
  }

  return (
    <div className="text-center">
      <div
        className="relative mx-auto mb-6 cursor-pointer select-none"
        style={{ width: 200, height: 200 }}
        onClick={spin}
      >
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-lg">
          {RESULTS.map((_, i) => {
            const angle = (360 / RESULTS.length) * i;
            const colors = ["#f8f1e5","#f0dcbe","#84a98c","#fb8500","#182a47","#f8f1e5","#f0dcbe","#84a98c"];
            const rad = (angle * Math.PI) / 180;
            const nextRad = (((angle + 360 / RESULTS.length) * Math.PI) / 180);
            const x1 = 100 + 95 * Math.cos(rad);
            const y1 = 100 + 95 * Math.sin(rad);
            const x2 = 100 + 95 * Math.cos(nextRad);
            const y2 = 100 + 95 * Math.sin(nextRad);
            return (
              <path
                key={i}
                d={`M100,100 L${x1},${y1} A95,95 0 0,1 ${x2},${y2} Z`}
                fill={colors[i]}
                stroke="#fff"
                strokeWidth="2"
              />
            );
          })}
          <circle cx="100" cy="100" r="20" fill="#182a47" />
          <text x="100" y="106" textAnchor="middle" fill="white" fontSize="18">🎲</text>
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 2s cubic-bezier(0.17,0.67,0.12,0.99)" : "none" }}
        />
        {/* Arrow pointer */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl">▼</div>
      </div>

      {result ? (
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <p className={`text-2xl font-bold mb-1 ${result.color}`}>{result.label}</p>
          <p className="text-gray-500 text-sm">{result.desc}</p>
        </div>
      ) : (
        <p className="text-gray-400 text-sm mb-4">{spinning ? "กำลังสุ่ม..." : "กดที่วงล้อเพื่อสุ่มดวง"}</p>
      )}

      <button
        onClick={spin}
        disabled={spinning}
        className="w-full bg-orange text-white font-bold py-3 rounded-xl disabled:opacity-50"
      >
        {spinning ? "กำลังหมุน..." : "🎰 สุ่มดวงอีกครั้ง"}
      </button>
    </div>
  );
}
