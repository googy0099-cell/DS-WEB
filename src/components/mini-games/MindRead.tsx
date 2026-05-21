"use client";

import { useState } from "react";

export default function MindRead() {
  const [pick, setPick] = useState<number | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [tries, setTries] = useState(0);

  function guess(n: number) {
    const secret = Math.floor(Math.random() * 10) + 1;
    setPick(n);
    setAnswer(secret);
    setTries((t) => t + 1);
    if (n === secret) setStreak((s) => s + 1);
    else setStreak(0);
  }

  function reset() {
    setPick(null);
    setAnswer(null);
  }

  const isCorrect = pick !== null && pick === answer;

  return (
    <div className="text-center">
      <p className="text-gray-500 text-sm mb-2">
        ระบบกำลังคิดเลข 1–10 อยู่... ทายให้ถูก!
      </p>

      {streak > 0 && (
        <div className="bg-orange/10 rounded-xl px-4 py-2 mb-4 inline-block">
          <p className="text-orange font-bold text-sm">🔥 ทายถูกติดกัน {streak} ครั้ง!</p>
        </div>
      )}

      {pick === null ? (
        <div className="grid grid-cols-5 gap-2 my-6">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => guess(n)}
              className="aspect-square rounded-xl bg-navy text-cream font-bold text-lg active:scale-90 transition-transform"
            >
              {n}
            </button>
          ))}
        </div>
      ) : (
        <div className="my-6">
          <div className={`rounded-2xl p-6 mb-4 ${isCorrect ? "bg-sage/20 border-2 border-sage" : "bg-red-50 border-2 border-red-200"}`}>
            <p className="text-4xl mb-2">{isCorrect ? "🎉" : "😅"}</p>
            <p className="font-bold text-navy text-lg">
              {isCorrect ? "ทายถูก!" : "ทายผิด!"}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              คุณเลือก <span className="font-bold text-navy">{pick}</span>
              {" · "}
              เฉลย <span className="font-bold text-orange">{answer}</span>
            </p>
          </div>
          <button onClick={reset} className="w-full bg-navy text-cream font-bold py-3 rounded-xl">
            🔮 ทายอีกครั้ง
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400">ทายแล้ว {tries} ครั้ง · ถูก {streak > 0 ? streak : 0} ครั้งติด</p>
    </div>
  );
}
