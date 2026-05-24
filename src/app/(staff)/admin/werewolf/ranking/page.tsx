"use client";

import { useState } from "react";
import useSWR from "swr";
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

export default function WerewolfRankingPage() {
  const [period, setPeriod] = useState("all");
  const { data: ranking } = useSWR<RankEntry[]>(`/api/werewolf/ranking?period=${period}`, fetcher, {
    refreshInterval: 30000,
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/werewolf" className="text-gray-400 hover:text-navy">←</Link>
        <h1 className="text-2xl font-bold text-navy">🏆 Werewolf Ranking</h1>
      </div>

      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mb-5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${period === p.key ? "bg-navy text-cream" : "text-gray-500"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {!ranking ? (
          <p className="text-center py-12 text-gray-400">กำลังโหลด...</p>
        ) : ranking.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">🐺</p>
            <p>ยังไม่มีข้อมูลการเล่น</p>
          </div>
        ) : (
          ranking.map((entry, i) => (
            <div
              key={entry.userId}
              className={`flex items-center gap-3 rounded-2xl p-4 ${
                i === 0 ? "bg-yellow-50 border-2 border-yellow-300" :
                i === 1 ? "bg-gray-50 border-2 border-gray-200" :
                i === 2 ? "bg-orange-50 border-2 border-orange-200" :
                "bg-white border border-gray-100"
              }`}
            >
              <span className="text-2xl w-8 text-center shrink-0">
                {MEDALS[i] ?? <span className="text-gray-400 text-base font-bold">{i + 1}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-navy truncate">{entry.name}</p>
                <p className="text-xs text-gray-400">{entry.total} เกม · ชนะ {entry.wins} · แพ้ {entry.losses}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-orange text-lg">{entry.winRate}%</p>
                <p className="text-xs text-gray-400">Win Rate</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
