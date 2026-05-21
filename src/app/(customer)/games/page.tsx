"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import GameCard from "@/components/games/GameCard";
import Image from "next/image";
import Link from "next/link";

interface GameGuide {
  id: number;
  nameTh: string;
  nameEn: string;
  summaryTh: string;
  youtubeUrl: string | null;
  imageUrl: string | null;
  minPlayers: number;
  maxPlayers: number;
  durationMin: number;
  tags: string;
}

const TAG_LABELS: Record<string, string> = {
  bluffing: "🃏 บลัฟฟิ่ง",
  card: "🎴 เกมไพ่",
  quick: "⚡ เล่นเร็ว",
  word: "💬 คำศัพท์",
  team: "👥 ทีม",
  family: "👨‍👩‍👧 ครอบครัว",
  creative: "🎨 สร้างสรรค์",
  classic: "⭐ คลาสสิก",
  "social deduction": "🕵️ จับโกหก",
  werewolf: "🐺 หมาป่า",
};

export default function GamesPage() {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [games, setGames] = useState<GameGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<string[]>([]);

  const fetchGames = useCallback(async (q: string, tag: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    const res = await fetch(`/api/games?${params}`);
    const data: GameGuide[] = await res.json();
    setGames(data);
    setLoading(false);
  }, []);

  // Load all games on mount and extract tags
  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((data: GameGuide[]) => {
        const tagSet = new Set<string>();
        data.forEach((g) => {
          JSON.parse(g.tags ?? "[]").forEach((t: string) => tagSet.add(t));
        });
        setAllTags([...tagSet]);
        setGames(data);
        setLoading(false);
      });
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchGames(query, activeTag), 300);
    return () => clearTimeout(t);
  }, [query, activeTag, fetchGames]);

  return (
    <div className="min-h-screen bg-cream pb-8">
      {/* Header */}
      <div className="bg-navy px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Image
              src="/DS-new-logo.png"
              alt="Dice Shop"
              width={40}
              height={22}
              className="object-contain brightness-0 invert"
            />
            <div>
              <p className="text-cream/70 text-xs">Dice Shop</p>
              <h1 className="text-cream font-bold text-lg leading-tight">คู่มือเกม</h1>
            </div>
          </div>
          <Link href="/" className="text-cream/60 text-xs underline">หน้าหลัก</Link>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อเกม..."
            className="w-full bg-white rounded-xl pl-9 pr-9 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-orange"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X size={14} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Tag filters */}
      <div className="px-4 py-3 border-b border-sand bg-cream sticky top-0 z-10">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTag("")}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeTag === "" ? "bg-navy text-cream" : "bg-sand text-navy"
            }`}
          >
            ทั้งหมด
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? "" : tag)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeTag === tag ? "bg-navy text-cream" : "bg-sand text-navy"
              }`}
            >
              {TAG_LABELS[tag] ?? tag}
            </button>
          ))}
        </div>
      </div>

      {/* Game list */}
      <div className="p-4 space-y-3">
        {loading ? (
          <p className="text-center py-12 text-gray-400">กำลังโหลด...</p>
        ) : games.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">🎲</p>
            <p>ไม่พบเกมที่ค้นหา</p>
          </div>
        ) : (
          games.map((game) => <GameCard key={game.id} game={game} />)
        )}
      </div>
    </div>
  );
}
