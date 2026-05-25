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
const MEDAL_BG = [
  "bg-yellow-50 border-yellow-200",
  "bg-gray-50 border-gray-200",
  "bg-orange-50 border-orange-100",
];

export default function WerewolfSection() {
  const [top3, setTop3] = useState<RankEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/werewolf/ranking?period=all")
      .then((r) => r.json())
      .then((data: RankEntry[]) => {
        setTop3(data.slice(0, 3));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <section className="py-16 px-4 bg-cream">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-orange font-semibold text-sm uppercase tracking-wider mb-1">
              Werewolf
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-navy">
              🐺 แรงกิ้งนักล่า
            </h2>
          </div>
          <Link
            href="/werewolf/ranking"
            className="text-orange font-semibold text-sm hover:underline shrink-0"
          >
            ดูทั้งหมด →
          </Link>
        </div>

        {/* Top 3 cards — same horizontal scroll pattern as GamesSection */}
        <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar">
          {!loaded ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-44 bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col animate-pulse"
              >
                <div className="h-24 bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))
          ) : top3.length === 0 ? (
            <div className="w-full py-10 text-center text-gray-400">
              <p className="text-4xl mb-2">🐺</p>
              <p className="text-sm">ยังไม่มีข้อมูลการเล่น — มาเป็นคนแรกกัน!</p>
            </div>
          ) : (
            top3.map((entry, i) => (
              <div
                key={entry.userId}
                className={`shrink-0 w-44 border rounded-2xl overflow-hidden shadow-sm flex flex-col ${MEDAL_BG[i]}`}
              >
                {/* Medal header */}
                <div className="flex items-center justify-center py-5 text-5xl bg-white/60">
                  {MEDALS[i]}
                </div>

                <div className="p-3 flex flex-col gap-1.5 flex-1">
                  <p className="font-bold text-navy text-sm leading-tight truncate">
                    {entry.name}
                  </p>
                  <div className="flex gap-1 flex-wrap mt-auto">
                    <span className="text-xs bg-white text-navy px-2 py-0.5 rounded-full">
                      {entry.total} เกม
                    </span>
                    <span className="text-xs bg-orange/10 text-orange px-2 py-0.5 rounded-full font-bold">
                      {entry.winRate}% win
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/werewolf/ranking"
            className="inline-flex items-center justify-center gap-2 bg-navy text-cream font-bold px-6 py-3 rounded-xl text-sm hover:bg-navy/90 transition-colors"
          >
            🏆 ดูอันดับทั้งหมด
          </Link>
          <Link
            href="/join"
            className="inline-flex items-center justify-center gap-2 bg-orange text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-orange/90 transition-colors"
          >
            🐺 เข้าร่วมเกม Werewolf
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-3">
          ต้องเป็นสมาชิกร้านก่อนเข้าร่วมเกม เพื่อระบบจะได้ track คะแนนให้ได้
        </p>

        {/* Free GM Canvas card */}
        <div className="mt-10 bg-[#0d0d0d] rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 shadow-lg">
          <div className="text-5xl shrink-0">🖥️</div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs font-bold text-orange uppercase tracking-wider mb-0.5">Free Tool</p>
            <h3 className="text-white font-bold text-lg leading-tight">
              Werewolf Canvas GM for You
            </h3>
            <p className="text-gray-400 text-sm mt-1">
              เครื่องมือ GM สำหรับทุกคน — จัดการผู้เล่น, ลำดับกลางคืน, วาดกระดาน
              ใช้ได้ฟรีโดยไม่ต้องสมัครสมาชิก
            </p>
          </div>
          <Link
            href="/gm-canvas"
            className="shrink-0 bg-yellow-400 text-black font-bold px-6 py-3 rounded-xl text-sm hover:bg-yellow-300 transition-colors whitespace-nowrap"
          >
            🎮 เปิดเครื่องมือ →
          </Link>
        </div>
      </div>
    </section>
  );
}
