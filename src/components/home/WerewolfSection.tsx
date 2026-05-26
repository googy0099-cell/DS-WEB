"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RankEntry {
  userId: number;
  name: string;
  total: number;
  wins: number;
  winRate: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_STYLES = [
  { border: "border-yellow-400/40", glow: "shadow-[0_0_24px_rgba(251,191,36,0.2)]", badge: "bg-yellow-400/10 text-yellow-300" },
  { border: "border-gray-400/30",   glow: "shadow-[0_0_16px_rgba(156,163,175,0.15)]", badge: "bg-gray-400/10 text-gray-300" },
  { border: "border-orange/30",     glow: "shadow-[0_0_16px_rgba(251,133,0,0.15)]",   badge: "bg-orange/10 text-orange" },
];

export default function WerewolfSection() {
  const [top3, setTop3] = useState<RankEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/werewolf/ranking?period=all")
      .then((r) => r.json())
      .then((data: RankEntry[]) => { setTop3(data.slice(0, 3)); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <section className="relative py-20 px-4 overflow-hidden bg-[#080d18]">
      {/* Decorative glow blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-orange/8 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-navy/60 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-[#0f1a2e] rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Top badge + link */}
        <div className="flex flex-col items-center mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange/10 border border-orange/25 text-orange text-xs font-bold uppercase tracking-widest mb-4">
            🐺 Dice Shop Werewolf
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center leading-tight">
            แรงกิ้งนักล่า
          </h2>
          <p className="text-white/35 text-sm text-center mt-2">ผู้เล่นที่แข็งแกร่งที่สุดแห่ง Dice Shop</p>
        </div>

        {/* Top 3 cards */}
        <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar justify-center">
          {!loaded ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="shrink-0 w-48 rounded-2xl bg-white/5 border border-white/10 animate-pulse h-40" />
            ))
          ) : top3.length === 0 ? (
            <div className="w-full py-12 text-center">
              <p className="text-5xl mb-3">🐺</p>
              <p className="text-white/40 text-sm">ยังไม่มีข้อมูลการเล่น — มาเป็นคนแรกกัน!</p>
            </div>
          ) : (
            top3.map((entry, i) => (
              <div
                key={entry.userId}
                className={`shrink-0 w-44 rounded-2xl border bg-white/5 backdrop-blur-sm flex flex-col overflow-hidden ${MEDAL_STYLES[i].border} ${MEDAL_STYLES[i].glow}`}
              >
                <div className="flex items-center justify-center py-6 text-5xl">
                  {MEDALS[i]}
                </div>
                <div className="px-3 pb-4 flex flex-col gap-2">
                  <p className="font-bold text-white text-sm leading-tight truncate text-center">
                    {entry.name}
                  </p>
                  <div className="flex gap-1 flex-wrap justify-center">
                    <span className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded-full">
                      {entry.total} เกม
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${MEDAL_STYLES[i].badge}`}>
                      {entry.winRate}% win
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/20 text-xs tracking-widest uppercase">Dice Shop</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-3">
          <Link
            href="/werewolf/ranking"
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all"
          >
            🏆 ดูอันดับทั้งหมด
          </Link>
          <Link
            href="/join"
            className="inline-flex items-center justify-center gap-2 bg-orange text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-orange/90 transition-all shadow-[0_0_24px_rgba(251,133,0,0.35)] hover:shadow-[0_0_32px_rgba(251,133,0,0.5)]"
          >
            🐺 เข้าร่วมเกม Werewolf
          </Link>
        </div>
        <p className="text-center text-xs text-white/20 mb-10">
          ต้องเป็นสมาชิกร้านก่อนเข้าร่วมเกม เพื่อให้ระบบ track คะแนนได้
        </p>

        {/* GM Canvas card */}
        <div className="relative rounded-2xl overflow-hidden border border-orange/20 bg-gradient-to-r from-[#0f1a2e] to-[#0a0f1e] shadow-[0_0_40px_rgba(251,133,0,0.1)]">
          <div className="absolute inset-0 bg-gradient-to-r from-orange/5 to-transparent pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-center gap-5 p-6">
            <div className="text-5xl shrink-0 drop-shadow-lg">🖥️</div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-bold text-orange uppercase tracking-widest mb-1">Free Tool</p>
              <h3 className="text-white font-bold text-lg leading-tight">
                Werewolf Canvas GM for You
              </h3>
              <p className="text-white/40 text-sm mt-1">
                จัดการผู้เล่น, ลำดับกลางคืน, วาดกระดาน — ฟรีไม่ต้องสมัคร
              </p>
            </div>
            <Link
              href="/gm-canvas"
              className="shrink-0 bg-orange text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-orange/90 transition-all shadow-[0_0_16px_rgba(251,133,0,0.3)] whitespace-nowrap"
            >
              🎮 เปิดเครื่องมือ →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
