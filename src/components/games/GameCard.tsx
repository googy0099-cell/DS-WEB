"use client";

import { useState } from "react";
import Image from "next/image";
import { Users, Clock, PlayCircle, ChevronDown, ChevronUp } from "lucide-react";

const DIFFICULTY_MAP: Record<string, { label: string; color: string }> = {
  easy:   { label: "ง่าย",          color: "bg-green-100 text-green-700" },
  medium: { label: "ปานกลาง",       color: "bg-yellow-100 text-yellow-700" },
  hard:   { label: "ยาก",           color: "bg-orange-100 text-orange-700" },
  expert: { label: "ผู้เชี่ยวชาญ", color: "bg-red-100 text-red-700" },
};

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

function getYoutubeEmbedId(url: string): string | null {
  // Handle full iframe embed code pasted from YouTube (e.g. <iframe src="...embed/ID?...">)
  const iframeMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
  if (iframeMatch) return iframeMatch[1];
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

export default function GameCard({ game }: { game: GameGuide }) {
  const [expanded, setExpanded] = useState(false);
  const tags: string[] = JSON.parse(game.tags ?? "[]");
  const embedId = game.youtubeUrl ? getYoutubeEmbedId(game.youtubeUrl) : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Game image */}
      {game.imageUrl && (
        <div className="relative aspect-[3/2] w-full max-h-48 overflow-hidden">
          <Image
            src={game.imageUrl}
            alt={game.nameTh}
            fill
            className="object-cover"
          />
        </div>
      )}

      {/* Header */}
      <button
        className="w-full p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-navy text-base leading-tight">{game.nameEn || game.nameTh}</h3>
            {game.nameTh && <p className="text-xs text-gray-400">{game.nameTh}</p>}
          </div>
          {expanded ? (
            <ChevronUp size={18} className="text-gray-400 shrink-0 mt-0.5" />
          ) : (
            <ChevronDown size={18} className="text-gray-400 shrink-0 mt-0.5" />
          )}
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1">
            <Users size={12} />
            {game.minPlayers}–{game.maxPlayers} คน
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {game.durationMin} นาที
          </span>
          {game.difficulty && DIFFICULTY_MAP[game.difficulty] && (
            <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${DIFFICULTY_MAP[game.difficulty].color}`}>
              {DIFFICULTY_MAP[game.difficulty].label}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((tag) => (
            <span key={tag} className="text-xs bg-sand text-navy px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-sand px-4 pb-4 pt-3 space-y-4">
          {game.summaryTh && (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {game.summaryTh}
            </p>
          )}

          {embedId ? (
            <div className="rounded-xl overflow-hidden aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${embedId}`}
                title={`วิธีเล่น ${game.nameTh}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          ) : game.youtubeUrl ? (
            <a
              href={game.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-red-50 text-red-600 font-medium text-sm px-4 py-2.5 rounded-xl w-full justify-center"
            >
              <PlayCircle size={18} />
              ดูคลิปสอนวิธีเล่น
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
