"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type GameGuide = {
  id: number;
  nameTh: string;
  nameEn: string;
  minPlayers: number;
  maxPlayers: number;
  durationMin: number;
  tags: string;
  imageUrl: string | null;
};

export default function GamesSection() {
  const [games, setGames] = useState<GameGuide[]>([]);

  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then(setGames)
      .catch(() => {});
  }, []);

  const displayGames =
    games.length > 0
      ? (() => {
          const popular = games.filter((g) => {
            try { return (JSON.parse(g.tags) as string[]).includes("ยอดนิยม"); } catch { return false; }
          });
          return (popular.length > 0 ? popular : games).slice(0, 6);
        })()
      : Array.from({ length: 5 }).map((_, i) => ({ id: i, nameTh: "", nameEn: "", minPlayers: 2, maxPlayers: 8, durationMin: 30, tags: "[]", imageUrl: null }));

  const isLoading = games.length === 0;

  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-orange font-semibold text-sm uppercase tracking-wider mb-1">บอร์ดเกม</p>
            <h2 className="text-2xl md:text-3xl font-bold text-navy">BOARD GAMES</h2>
          </div>
          <Link href="/games" className="text-orange font-semibold text-sm hover:underline shrink-0">
            ดูทั้งหมด →
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar">
          {displayGames.map((game) => {
            const tags = (() => { try { return JSON.parse(game.tags) as string[]; } catch { return []; } })();
            return (
              <Link
                key={game.id}
                href="/games"
                className="shrink-0 w-44 bg-cream rounded-2xl overflow-hidden shadow-sm flex flex-col group hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
              >
                <div className="relative aspect-[4/3] w-full bg-sand flex items-center justify-center overflow-hidden">
                  {isLoading ? (
                    <div className="w-full h-full bg-sand animate-pulse" />
                  ) : game.imageUrl ? (
                    <Image src={game.imageUrl} alt={game.nameTh} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <span className="text-4xl">🎲</span>
                  )}
                </div>
                <div className="p-3 flex flex-col gap-1.5 flex-1">
                  {isLoading ? (
                    <>
                      <div className="h-4 bg-sand rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-sand rounded animate-pulse w-1/2 mt-auto" />
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-navy text-sm leading-tight">{game.nameEn || game.nameTh}</p>
                      {game.nameEn && game.nameTh && <p className="text-gray-400 text-xs">{game.nameTh}</p>}
                      <div className="flex gap-1 flex-wrap mt-auto">
                        <span className="text-xs bg-white text-navy px-2 py-0.5 rounded-full">
                          {game.minPlayers}–{game.maxPlayers} คน
                        </span>
                        {tags[0] && (
                          <span className="text-xs bg-orange/10 text-orange px-2 py-0.5 rounded-full">
                            {tags[0]}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/games"
            className="inline-block bg-navy text-cream font-bold px-6 py-3 rounded-xl text-sm hover:bg-navy/90 transition-colors"
          >
            🎲 ดูคู่มือเกมทั้งหมด
          </Link>
        </div>
      </div>
    </section>
  );
}
