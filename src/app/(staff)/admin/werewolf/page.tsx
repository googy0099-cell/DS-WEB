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
  session: { id: number; phase: string } | null;
}

const PHASE_LABEL: Record<string, { label: string; color: string }> = {
  SETUP:   { label: "แจกไพ่แล้ว รอเริ่ม", color: "bg-yellow-100 text-yellow-700" },
  PLAYING: { label: "🔴 กำลังเล่น",        color: "bg-red-100 text-red-700" },
  ENDED:   { label: "จบแล้ว",              color: "bg-gray-100 text-gray-500" },
};

export default function WerewolfAdminPage() {
  const { data: rooms, mutate } = useSWR<Room[]>("/api/werewolf/rooms", fetcher, { refreshInterval: 5000 });
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

  const liveRoom = rooms?.find((r) => r.session?.phase === "PLAYING");
  const setupRoom = rooms?.find((r) => r.session?.phase === "SETUP");
  const activeRoom = liveRoom ?? setupRoom;

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">🐺 Werewolf GM</h1>
        <p className="text-sm text-gray-500 mt-1">จัดการห้องเกม · แจกไพ่ · ดำเนินเกม</p>
      </div>

      {/* ── LIVE GAME BANNER ── */}
      {liveRoom && (
        <div className="bg-red-600 text-white rounded-2xl p-4 mb-5 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0" />
            <p className="font-bold text-lg">กำลังเล่นอยู่ — ห้อง {liveRoom.code}</p>
          </div>
          <p className="text-red-100 text-sm mb-4">{liveRoom._count.players} ผู้เล่น · เกมดำเนินอยู่</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/admin/werewolf/canvas?room=${liveRoom.code}`}
              className="bg-white text-red-700 font-bold py-3 rounded-xl text-sm text-center shadow"
            >
              🖥️ GM Canvas
            </Link>
            <Link
              href={`/admin/werewolf/rooms/${liveRoom.code}`}
              className="bg-red-700/50 text-white font-bold py-3 rounded-xl text-sm text-center border border-red-400"
            >
              🔍 ตรวจสอบห้อง
            </Link>
          </div>
        </div>
      )}

      {/* ── SETUP READY BANNER (has session but not started) ── */}
      {!liveRoom && setupRoom && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🃏</span>
            <p className="font-bold text-yellow-800">แจกไพ่แล้ว รอเปิด Canvas</p>
          </div>
          <p className="text-yellow-600 text-sm mb-4">ห้อง {setupRoom.code} · {setupRoom._count.players} ผู้เล่น</p>
          <Link
            href={`/admin/werewolf/canvas?room=${setupRoom.code}`}
            className="block w-full bg-yellow-500 text-white font-bold py-3 rounded-xl text-sm text-center shadow"
          >
            🖥️ เปิด GM Canvas → เริ่มเกม!
          </Link>
        </div>
      )}

      {/* ── CREATE ROOM ── */}
      <button
        onClick={createRoom}
        disabled={creating}
        className="w-full bg-navy text-cream py-4 rounded-2xl font-bold text-base mb-5 shadow-md hover:bg-navy/90 transition-colors disabled:opacity-50"
      >
        {creating ? "กำลังสร้าง..." : "➕ สร้างห้องเกมใหม่"}
      </button>

      {/* ── ROOM LIST ── */}
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">ห้องของฉัน</h2>
      <div className="space-y-3 mb-6">
        {!rooms ? (
          <p className="text-center text-gray-400 py-8">กำลังโหลด...</p>
        ) : rooms.length === 0 ? (
          <p className="text-center text-gray-400 py-8">ยังไม่มีห้อง — กด สร้างห้องเกมใหม่ ด้านบน</p>
        ) : (
          rooms.map((room) => {
            const phase = room.session?.phase;
            const phaseInfo = phase ? PHASE_LABEL[phase] : null;
            const isLive = phase === "PLAYING";

            return (
              <div
                key={room.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border transition-colors ${isLive ? "border-red-300 shadow-red-100" : "border-gray-100"}`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-navy text-xl tracking-[0.15em]">{room.code}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {room._count.players} ผู้เล่น · {room._count.games} เกม
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${room.isOpen ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {room.isOpen ? "● เปิดอยู่" : "○ ปิดแล้ว"}
                    </span>
                    {phaseInfo && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${phaseInfo.color}`}>
                        {phaseInfo.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className={`grid gap-2 ${room.session ? "grid-cols-3" : "grid-cols-2"}`}>
                  <Link
                    href={`/admin/werewolf/rooms/${room.code}`}
                    className="bg-navy text-cream text-xs font-bold py-2.5 rounded-xl text-center"
                  >
                    จัดการห้อง
                  </Link>

                  {room.session ? (
                    <>
                      <Link
                        href={`/admin/werewolf/rooms/${room.code}?check=1`}
                        className="bg-gray-100 text-gray-700 text-xs font-bold py-2.5 rounded-xl text-center"
                      >
                        🔍 เช็คโรล
                      </Link>
                      <Link
                        href={`/admin/werewolf/canvas?room=${room.code}`}
                        className={`text-xs font-bold py-2.5 rounded-xl text-center ${isLive ? "bg-red-600 text-white" : "bg-indigo-600 text-white"}`}
                      >
                        🖥️ Canvas
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={`/admin/werewolf/rooms/${room.code}`}
                      className="bg-orange text-white text-xs font-bold py-2.5 rounded-xl text-center"
                    >
                      🎲 แจกไพ่
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── CUSTOMER JOIN SECTION ── */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 mb-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">ลูกค้าเข้าเกม</p>
        {activeRoom ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              ห้อง <span className="font-bold text-navy tracking-widest">{activeRoom.code}</span> กำลังรอผู้เล่น
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/join/${activeRoom.code}`}
                target="_blank"
                className="bg-yellow-500 text-black text-xs font-bold py-3 rounded-xl text-center"
              >
                🔗 ลิงก์ join
              </Link>
              <Link
                href={`/admin/werewolf/rooms/${activeRoom.code}`}
                className="bg-white border border-gray-200 text-gray-700 text-xs font-bold py-3 rounded-xl text-center"
              >
                📱 QR Code
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500 mb-3">สร้างห้องและแจกไพ่ก่อน จากนั้นผู้เล่นสามารถเข้าได้ที่</p>
            <Link
              href="/join"
              target="_blank"
              className="inline-block bg-yellow-500 text-black font-bold px-6 py-2.5 rounded-xl text-sm"
            >
              🐺 /join — หน้าเข้าเกมสำหรับลูกค้า
            </Link>
          </div>
        )}
      </div>

      {/* ── BOTTOM LINKS ── */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/admin/werewolf/ranking"
          className="text-center bg-orange/10 text-orange font-bold py-3 rounded-xl text-sm hover:bg-orange/20 transition-colors"
        >
          🏆 อันดับ Werewolf
        </Link>
        <Link
          href="/werewolf/ranking"
          target="_blank"
          className="text-center bg-gray-100 text-gray-600 font-bold py-3 rounded-xl text-sm hover:bg-gray-200 transition-colors"
        >
          📊 อันดับ (ลูกค้าเห็น)
        </Link>
      </div>
    </div>
  );
}
