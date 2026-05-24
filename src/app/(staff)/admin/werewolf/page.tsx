"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Room {
  id: number;
  code: string;
  isOpen: boolean;
  createdAt: string;
  _count: { players: number; games: number };
}

export default function WerewolfAdminPage() {
  const { data: rooms, mutate } = useSWR<Room[]>("/api/werewolf/rooms", fetcher);
  const [creating, setCreating] = useState(false);

  async function createRoom() {
    setCreating(true);
    try {
      const res = await fetch("/api/werewolf/rooms", { method: "POST" });
      if (res.ok) mutate();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">🐺 Werewolf GM</h1>
          <p className="text-sm text-gray-500 mt-1">จัดการห้องเกมและบันทึกผล</p>
        </div>
        <Link
          href="/admin/werewolf/canvas"
          className="bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-indigo-800 transition-colors"
        >
          🎲 เปิด GM Canvas
        </Link>
      </div>

      <button
        onClick={createRoom}
        disabled={creating}
        className="w-full bg-navy text-cream py-3.5 rounded-2xl font-bold text-base mb-6 shadow-md hover:bg-navy/90 transition-colors disabled:opacity-50"
      >
        {creating ? "กำลังสร้าง..." : "➕ สร้างห้องเกมใหม่"}
      </button>

      <h2 className="text-sm font-bold text-gray-500 mb-3">ห้องล่าสุด</h2>
      <div className="space-y-3">
        {!rooms ? (
          <p className="text-center text-gray-400 py-8">กำลังโหลด...</p>
        ) : rooms.length === 0 ? (
          <p className="text-center text-gray-400 py-8">ยังไม่มีห้อง — กด "สร้างห้องเกมใหม่" ด้านบน</p>
        ) : (
          rooms.map((room) => (
            <Link
              key={room.id}
              href={`/admin/werewolf/rooms/${room.code}`}
              className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-navy/30 transition-colors"
            >
              <div>
                <p className="font-bold text-navy text-lg tracking-widest">{room.code}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {room._count.players} ผู้เล่น · {room._count.games} เกม
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  room.isOpen ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {room.isOpen ? "เปิดอยู่" : "ปิดแล้ว"}
              </span>
            </Link>
          ))
        )}
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href="/admin/werewolf/ranking"
          className="flex-1 text-center bg-orange/10 text-orange font-bold py-3 rounded-xl text-sm hover:bg-orange/20 transition-colors"
        >
          🏆 ดูอันดับ Werewolf
        </Link>
      </div>
    </div>
  );
}
