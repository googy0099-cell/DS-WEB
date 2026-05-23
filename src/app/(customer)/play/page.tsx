"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import LuckyDraw from "@/components/mini-games/LuckyDraw";
import SpeedTap from "@/components/mini-games/SpeedTap";
import MindRead from "@/components/mini-games/MindRead";

const GAMES = [
  {
    id: "lucky",
    icon: "🎰",
    label: "สุ่มดวง",
    desc: "หมุนวงล้อดูดวงวันนี้",
  },
  {
    id: "speed",
    icon: "⚡",
    label: "กดแข่งความเร็ว",
    desc: "กด 20 ครั้งให้เร็วที่สุด",
  },
  {
    id: "mind",
    icon: "🔮",
    label: "ทายใจ",
    desc: "ทายเลขที่ระบบคิดอยู่",
  },
];

export default function PlayPage() {
  const [active, setActive] = useState<string | null>(null);
  const { data: session, status } = useSession();

  const activeGame = GAMES.find((g) => g.id === active);

  if (status === "loading") {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-cream pt-16 flex items-center justify-center">
          <p className="text-gray-400">กำลังโหลด...</p>
        </div>
      </>
    );
  }

  if (!session?.user) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-cream pt-16 flex flex-col items-center justify-center px-4 text-center">
          <span className="text-6xl mb-4">🎮</span>
          <h1 className="text-2xl font-bold text-navy mb-2">มินิเกม</h1>
          <p className="text-gray-500 mb-6 max-w-sm">
            กรุณาสมัครสมาชิกและเข้าสู่ระบบก่อน เพื่อเล่นมินิเกม
          </p>
          <Link
            href="/login?callbackUrl=/play"
            className="bg-orange text-white font-bold px-8 py-3 rounded-xl text-base hover:bg-orange/90 transition-colors"
          >
            เข้าสู่ระบบ / สมัครสมาชิก
          </Link>
          <Link href="/" className="mt-4 text-sm text-gray-400 underline">
            กลับหน้าแรก
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
    <Navbar />
    <div className="min-h-screen bg-cream pb-8 pt-16">
      <div className="bg-navy px-4 pt-6 pb-6 text-center">
        <h1 className="text-cream font-bold text-xl">🎮 มินิเกม</h1>
        <p className="text-cream/60 text-xs mt-1">เล่นเพลินๆ ระหว่างรอเพื่อน</p>
      </div>

      {/* Game selector tabs */}
      <div className="flex gap-2 p-4 overflow-x-auto no-scrollbar">
        {GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => setActive(g.id)}
            className={`shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-2xl transition-all ${
              active === g.id ? "bg-navy text-cream scale-105 shadow-md" : "bg-white text-navy"
            }`}
          >
            <span className="text-2xl">{g.icon}</span>
            <span className="text-xs font-semibold">{g.label}</span>
          </button>
        ))}
      </div>

      <div className="px-4">
        {!active ? (
          <div className="space-y-3 mt-2">
            {GAMES.map((g) => (
              <button
                key={g.id}
                onClick={() => setActive(g.id)}
                className="w-full bg-white rounded-2xl p-4 text-left flex items-center gap-4 shadow-sm active:scale-[0.98] transition-transform"
              >
                <span className="text-4xl">{g.icon}</span>
                <div>
                  <p className="font-bold text-navy">{g.label}</p>
                  <p className="text-xs text-gray-400">{g.desc}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-navy text-lg">
                {activeGame?.icon} {activeGame?.label}
              </h2>
              <button
                onClick={() => setActive(null)}
                className="text-xs text-gray-400 underline"
              >
                เปลี่ยนเกม
              </button>
            </div>

            {active === "lucky" && <LuckyDraw />}
            {active === "speed" && <SpeedTap />}
            {active === "mind" && <MindRead />}
          </div>
        )}
      </div>
    </div>
    <Footer />
    </>
  );
}
