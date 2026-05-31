"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Users, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";

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
  difficulty: string | null;
}

const DIFFICULTY_MAP: Record<string, { label: string; color: string }> = {
  easy:   { label: "ง่าย",          color: "bg-green-100 text-green-700" },
  medium: { label: "ปานกลาง",       color: "bg-yellow-100 text-yellow-700" },
  hard:   { label: "ยาก",           color: "bg-orange-100 text-orange-700" },
  expert: { label: "ผู้เชี่ยวชาญ", color: "bg-red-100 text-red-700" },
};

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
  const PAGE_SIZE = 24;
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [games, setGames] = useState<GameGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const fetchGames = useCallback(async (q: string, tag: string) => {
    setLoading(true);
    setVisibleCount(PAGE_SIZE);
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
      <Navbar />
      {/* Search bar */}
      <div className="bg-navy px-4 pt-20 pb-4">
        <div className="relative max-w-2xl mx-auto">
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

      {/* Tag filter dropdown */}
      <div className="px-4 py-3 border-b border-sand bg-cream sticky top-16 z-10">
        <div className="max-w-4xl mx-auto">
          <select
            value={activeTag}
            onChange={(e) => setActiveTag(e.target.value)}
            className="w-full sm:w-56 bg-white border border-sand rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-orange appearance-none bg-no-repeat pr-8"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: "right 10px center" }}
          >
            <option value="">ทุกประเภท</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {TAG_LABELS[tag] ?? tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Game grid */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
                <div className="aspect-square bg-sand" />
                <div className="p-2.5 space-y-1.5">
                  <div className="h-3 bg-sand rounded w-3/4" />
                  <div className="h-2.5 bg-sand rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-2">🎲</p>
            <p>ไม่พบเกมที่ค้นหา</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {games.slice(0, visibleCount).map((game) => {
                const tags: string[] = (() => { try { return JSON.parse(game.tags ?? "[]"); } catch { return []; } })();
                return (
                  <Link
                    key={game.id}
                    href={`/games/${game.id}`}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm active:scale-[0.97] transition-transform"
                  >
                    <div className="relative aspect-square w-full bg-sand flex items-center justify-center">
                      {game.imageUrl ? (
                        <Image src={game.imageUrl} alt={game.nameTh} fill className="object-cover" />
                      ) : (
                        <span className="text-4xl">🎲</span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="font-bold text-navy text-sm leading-tight line-clamp-2">{game.nameEn || game.nameTh}</p>
                      {game.nameEn && game.nameTh && <p className="text-[10px] text-gray-400 line-clamp-1">{game.nameTh}</p>}
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                        <span className="flex items-center gap-0.5"><Users size={10} />{game.minPlayers}–{game.maxPlayers}</span>
                        <span className="flex items-center gap-0.5"><Clock size={10} />{game.durationMin}น.</span>
                      </div>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {game.difficulty && DIFFICULTY_MAP[game.difficulty] && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_MAP[game.difficulty].color}`}>
                            {DIFFICULTY_MAP[game.difficulty].label}
                          </span>
                        )}
                        {tags[0] && (
                          <span className="text-[10px] bg-orange/10 text-orange px-2 py-0.5 rounded-full">
                            {tags[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {visibleCount < games.length && (
              <button
                onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                className="mt-6 w-full py-3 rounded-2xl border-2 border-sand text-navy font-semibold text-sm hover:border-orange hover:text-orange transition-colors"
              >
                ดูเพิ่มเติม ({games.length - visibleCount} เกม)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
