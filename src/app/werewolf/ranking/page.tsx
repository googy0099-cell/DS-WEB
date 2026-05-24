"use client";

import { useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface RankEntry {
  userId: number;
  name: string;
  total: number;
  wins: number;
  losses: number;
  winRate: number;
}

const PERIODS = [
  { key: "all", label: "ตลอดกาล" },
  { key: "month", label: "เดือนนี้" },
  { key: "week", label: "สัปดาห์นี้" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

export default function WerewolfRankingPublicPage() {
  const [period, setPeriod] = useState("all");
  const { data: ranking } = useSWR<RankEntry[]>(
    `/api/werewolf/ranking?period=${period}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      {/* Header */}
      <div className="bg-navy px-4 pt-10 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Image
                src="/DS-new-logo.png"
                alt="Dice Shop"
                width={40}
                height={22}
                className="object-contain brightness-0 invert"
              />
              <div>
                <p className="text-cream/60 text-xs">Dice Shop · Werewolf</p>
                <h1 className="text-cream font-bold text-xl leading-tight">
                  🐺 แรงกิ้งนักล่า
                </h1>
              </div>
            </div>
            <Link href="/" className="text-cream/50 text-xs hover:text-cream/80">
              หน้าหลัก
            </Link>
          </div>

          {/* Period tabs */}
          <div className="flex bg-navy/50 rounded-xl p-1 gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === p.key ? "bg-orange text-white" : "text-cream/60"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ranking list */}
      <div className="max-w-lg mx-auto p-4 space-y-2">
        {!ranking ? (
          <p className="text-center py-12 text-gray-500">กำลังโหลด...</p>
        ) : ranking.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-5xl mb-3">🐺</p>
            <p className="font-bold text-gray-400">ยังไม่มีข้อมูลการเล่น</p>
            <p className="text-sm text-gray-600 mt-1">เล่นเกมแล้วอันดับจะแสดงที่นี่</p>
          </div>
        ) : (
          ranking.map((entry, i) => (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 rounded-2xl p-4 ${
                i === 0
                  ? "bg-yellow-900/30 border-2 border-yellow-500/50"
                  : i === 1
                  ? "bg-gray-700/30 border-2 border-gray-500/50"
                  : i === 2
                  ? "bg-orange-900/30 border-2 border-orange-500/40"
                  : "bg-gray-800/50 border border-gray-700"
              }`}
            >
              <span className="text-2xl w-8 text-center shrink-0">
                {i < 3 ? (
                  MEDALS[i]
                ) : (
                  <span className="text-gray-500 text-base font-bold">{i + 1}</span>
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{entry.name}</p>
                <p className="text-xs text-gray-400">
                  {entry.total} เกม · ชนะ {entry.wins} · แพ้ {entry.losses}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-orange text-lg">{entry.winRate}%</p>
                <p className="text-xs text-gray-500">Win Rate</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Join CTA */}
      <div className="max-w-lg mx-auto px-4 pb-12 pt-2">
        <Link
          href="/join"
          className="flex items-center justify-center gap-2 w-full bg-orange text-white font-bold py-4 rounded-2xl text-sm shadow-lg"
        >
          🐺 เข้าร่วมเกม Werewolf
        </Link>
        <p className="text-center text-xs text-gray-600 mt-2">ต้องเป็นสมาชิกร้านก่อนเข้าร่วม</p>
      </div>
    </div>
  );
}
