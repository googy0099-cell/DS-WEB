"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";

type CustomGame = {
  id: number;
  name: string;
  description: string | null;
  coverUrl: string | null;
};

export default function PlayPage() {
  const [customGames, setCustomGames] = useState<CustomGame[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: session, status } = useSession();

  useEffect(() => {
    fetch("/api/mini-games")
      .then((r) => r.json())
      .then(setCustomGames)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

        <div className="max-w-4xl mx-auto px-4 pt-4">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
                  <div className="aspect-square bg-sand" />
                  <div className="p-3 space-y-1.5">
                    <div className="h-3 bg-sand rounded w-3/4" />
                    <div className="h-2.5 bg-sand rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : customGames.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-2">🎮</p>
              <p>ยังไม่มีมินิเกมในขณะนี้</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {customGames.map((g) => (
                <Link
                  key={g.id}
                  href={`/play/game/${g.id}`}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm active:scale-[0.97] transition-transform"
                >
                  <div className="relative aspect-square bg-sand flex items-center justify-center">
                    {g.coverUrl ? (
                      <Image src={g.coverUrl} alt={g.name} fill className="object-cover" />
                    ) : (
                      <span className="text-4xl">🎮</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-navy text-sm">{g.name}</p>
                    {g.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{g.description}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
