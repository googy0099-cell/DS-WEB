"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Users, Clock, ChevronLeft } from "lucide-react";
import Navbar from "@/components/shared/Navbar";

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

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-navy">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      nodes.push(<h2 key={i} className="text-base font-bold text-navy mt-4 first:mt-0 border-b border-sand pb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      nodes.push(<h3 key={i} className="text-sm font-semibold text-navy/80 mt-3">{line.slice(4)}</h3>);
    } else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) { items.push(lines[i].slice(2)); i++; }
      nodes.push(
        <ul key={`ul-${i}`} className="space-y-1.5 mt-1.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
              <span className="text-orange shrink-0 mt-0.5">•</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() === "") {
      // paragraph break — skip
    } else {
      nodes.push(<p key={i} className="text-sm text-gray-700 leading-relaxed">{renderInline(line)}</p>);
    }
    i++;
  }
  return nodes;
}

function getYoutubeEmbedId(url: string): string | null {
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

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<GameGuide | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/games/${id}`)
      .then((r) => r.json())
      .then((data) => { setGame(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-cream pt-16 flex items-center justify-center">
          <p className="text-gray-400">กำลังโหลด...</p>
        </div>
      </>
    );
  }

  if (!game || (game as { error?: string }).error) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-cream pt-16 flex flex-col items-center justify-center">
          <p className="text-4xl mb-3">🎲</p>
          <p className="text-gray-500">ไม่พบเกม</p>
          <button onClick={() => router.back()} className="mt-4 text-orange underline text-sm">
            ย้อนกลับ
          </button>
        </div>
      </>
    );
  }

  const tags: string[] = (() => { try { return JSON.parse(game.tags ?? "[]"); } catch { return []; } })();
  const embedId = game.youtubeUrl ? getYoutubeEmbedId(game.youtubeUrl) : null;

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-cream pt-16">
        <div className="max-w-2xl mx-auto">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-navy/70 text-sm px-4 py-4 hover:text-navy"
          >
            <ChevronLeft size={18} />
            คู่มือเกม
          </button>

          {/* Game image */}
          {game.imageUrl && (
            <div className="mx-4 rounded-2xl overflow-hidden aspect-[4/3] relative bg-sand mb-4">
              <Image src={game.imageUrl} alt={game.nameTh} fill className="object-cover" />
            </div>
          )}

          <div className="px-4 space-y-4 pb-12">
            {/* Name + tags */}
            <div>
              <h1 className="text-2xl font-bold text-navy">{game.nameEn || game.nameTh}</h1>
              {game.nameEn && game.nameTh && <p className="text-gray-400 text-sm mt-0.5">{game.nameTh}</p>}

              <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Users size={15} />
                  {game.minPlayers}–{game.maxPlayers} คน
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={15} />
                  {game.durationMin} นาที
                </span>
                {game.difficulty && DIFFICULTY_MAP[game.difficulty] && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${DIFFICULTY_MAP[game.difficulty].color}`}>
                    {DIFFICULTY_MAP[game.difficulty].label}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {tags.map((tag) => (
                  <span key={tag} className="text-xs bg-sand text-navy px-2.5 py-1 rounded-full font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Summary */}
            {game.summaryTh && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-sm font-bold text-navy mb-3">วิธีเล่น</p>
                <div className="space-y-2">{renderMarkdown(game.summaryTh)}</div>
              </div>
            )}

            {/* YouTube embed */}
            {embedId ? (
              <div className="rounded-2xl overflow-hidden aspect-video shadow-sm">
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
                className="flex items-center justify-center gap-2 bg-red-50 text-red-600 font-medium text-sm px-4 py-3 rounded-2xl"
              >
                ▶ ดูคลิปสอนวิธีเล่น
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
