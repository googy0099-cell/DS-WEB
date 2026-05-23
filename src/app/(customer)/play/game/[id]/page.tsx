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
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/mini-games")
      .then((r) => r.json())
      .then((data: MiniGame[]) => {
        const found = data.find((g) => g.id === Number(id));
        if (!found) { setError(true); return; }
        setGame(found);
        // Fetch HTML content as text to avoid Content-Disposition download
        return fetch(found.htmlUrl).then((r) => r.text()).then(setHtmlContent);
      })
      .catch(() => setError(true));
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-navy flex flex-col items-center justify-center gap-4">
        <p className="text-cream/60">ไม่พบเกม</p>
        <button onClick={() => router.back()} className="text-orange text-sm underline">ย้อนกลับ</button>
      </div>
    );
  }

  if (!htmlContent) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <p className="text-cream/60">กำลังโหลดเกม...</p>
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
        <p className="text-cream font-semibold text-sm">{game?.name}</p>
      </div>
      <iframe
        srcDoc={htmlContent}
        className="flex-1 w-full border-0 bg-white"
        allow="fullscreen"
        title={game?.name}
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
      />
    </div>
  );
}
