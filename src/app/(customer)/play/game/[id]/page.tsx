"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

type MiniGame = {
  id: number;
  name: string;
  htmlUrl: string;
};

export default function MiniGamePlayerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<MiniGame | null>(null);

  useEffect(() => {
    fetch("/api/mini-games")
      .then((r) => r.json())
      .then((data: MiniGame[]) => {
        const found = data.find((g) => g.id === Number(id));
        setGame(found ?? null);
      });
  }, [id]);

  if (!game) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <p className="text-cream/60">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-navy">
      <div className="flex items-center gap-3 px-4 py-2 bg-navy shrink-0">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-cream/70 hover:text-cream text-sm"
        >
          <ChevronLeft size={18} />
          ออก
        </button>
        <p className="text-cream font-semibold text-sm">{game.name}</p>
      </div>
      <iframe
        src={game.htmlUrl}
        className="flex-1 w-full border-0 bg-white"
        allow="fullscreen"
        title={game.name}
      />
    </div>
  );
}
