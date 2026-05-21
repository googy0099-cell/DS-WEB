"use client";

import { useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Member {
  id: number;
  nickname: string;
  points: number;
  totalSpentTHB: number;
}

const TABS = [
  { key: "all", label: "ตลอดกาล" },
  { key: "month", label: "เดือนนี้" },
  { key: "week", label: "สัปดาห์นี้" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [period, setPeriod] = useState("all");
  const { data: members } = useSWR<Member[]>(
    `/api/leaderboard?period=${period}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  return (
    <div className="min-h-screen bg-cream pb-8">
      <div className="bg-navy px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Image src="/DS-new-logo.png" alt="Dice Shop" width={40} height={22} className="object-contain brightness-0 invert" />
            <div>
              <p className="text-cream/70 text-xs">Dice Shop</p>
              <h1 className="text-cream font-bold text-xl leading-tight">🏆 Leaderboard</h1>
            </div>
          </div>
          <Link href="/" className="text-cream/60 text-xs underline">หน้าหลัก</Link>
        </div>

        <div className="flex bg-navy/50 rounded-xl p-1 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPeriod(tab.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === tab.key ? "bg-orange text-white" : "text-cream/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-2">
        {!members ? (
          <p className="text-center py-12 text-gray-400">กำลังโหลด...</p>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">🎲</p>
            <p>ยังไม่มีสมาชิกในช่วงนี้</p>
          </div>
        ) : (
          members.map((member, i) => (
            <div
              key={member.id}
              className={`flex items-center gap-3 rounded-2xl p-4 ${
                i === 0 ? "bg-yellow-50 border-2 border-yellow-300" :
                i === 1 ? "bg-gray-50 border-2 border-gray-200" :
                i === 2 ? "bg-orange-50 border-2 border-orange-200" :
                "bg-white"
              }`}
            >
              <span className="text-2xl w-8 text-center shrink-0">
                {MEDALS[i] ?? <span className="text-gray-400 text-base font-bold">{i + 1}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-navy truncate">{member.nickname}</p>
                <p className="text-xs text-gray-400">ใช้จ่ายรวม ฿{member.totalSpentTHB.toLocaleString("th-TH")}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-orange text-lg">{member.points.toLocaleString("th-TH")}</p>
                <p className="text-xs text-gray-400">แต้ม</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-4">
        <Link
          href="/play"
          className="flex items-center justify-center gap-2 w-full bg-orange text-white font-bold py-3 rounded-xl text-sm mt-2"
        >
          🎮 เล่นมินิเกมเพื่อรับแต้ม
        </Link>
      </div>
    </div>
  );
}
