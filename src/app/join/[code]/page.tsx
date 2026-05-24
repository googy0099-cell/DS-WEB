"use client";

import { use, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface RoomInfo {
  code: string;
  isOpen: boolean;
  playerCount: number;
  gmName: string;
}

export default function JoinRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [roomError, setRoomError] = useState("");
  const [seatName, setSeatName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    fetch(`/api/werewolf/rooms/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setRoomError(data.error);
        else setRoom(data);
      })
      .catch(() => setRoomError("เกิดข้อผิดพลาด"));
  }, [code]);

  useEffect(() => {
    if (session?.user?.firstName) setSeatName(session.user.firstName);
  }, [session]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!seatName.trim()) return;
    setJoining(true);
    setJoinError("");
    try {
      const res = await fetch(`/api/werewolf/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatName: seatName.trim() }),
      });
      const data = await res.json();
      if (res.ok || data.alreadyJoined) {
        setJoined(true);
      } else {
        setJoinError(data.error || "เกิดข้อผิดพลาด");
      }
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center p-6">
      <div className="mb-6 text-center">
        <Image src="/DS-new-logo.png" alt="Dice Shop" width={60} height={33} className="object-contain brightness-0 invert mx-auto mb-3" />
        <p className="text-gray-400 text-xs">Dice Shop Werewolf</p>
      </div>

      {roomError ? (
        <div className="text-center">
          <p className="text-red-400 mb-4">{roomError}</p>
          <Link href="/join" className="text-yellow-400 text-sm underline">ลองใส่ code ใหม่</Link>
        </div>
      ) : !room ? (
        <p className="text-gray-400">กำลังโหลด...</p>
      ) : !room.isOpen ? (
        <div className="text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-white font-bold">ห้องนี้ปิดแล้ว</p>
          <p className="text-gray-400 text-sm mt-2">ติดต่อ GM เพื่อเปิดห้อง</p>
        </div>
      ) : joined ? (
        <div className="text-center">
          <p className="text-5xl mb-4">✅</p>
          <h2 className="text-white text-xl font-bold mb-2">คุณ Join แล้ว!</h2>
          <p className="text-gray-300 mb-1">ห้อง <span className="text-yellow-400 font-bold tracking-widest">{code}</span></p>
          <p className="text-gray-400 text-sm mb-6">GM: {room.gmName} · {room.playerCount} ผู้เล่น</p>
          <p className="text-gray-400 text-sm">รอ GM เริ่มเกม 🐺</p>
        </div>
      ) : (
        <div className="w-full max-w-xs">
          <div className="bg-gray-800 rounded-2xl p-4 mb-5 text-center">
            <p className="text-yellow-400 font-bold tracking-[0.3em] text-2xl">{code}</p>
            <p className="text-gray-400 text-xs mt-1">GM: {room.gmName} · {room.playerCount} ผู้เล่น</p>
          </div>

          {status === "loading" ? (
            <p className="text-gray-400 text-center">กำลังโหลด...</p>
          ) : !session ? (
            <div className="text-center">
              <p className="text-gray-300 mb-4">ต้องเข้าสู่ระบบก่อน join ห้อง</p>
              <Link
                href={`/login?callbackUrl=/join/${code}`}
                className="block w-full bg-yellow-500 text-black font-bold py-3.5 rounded-xl text-center"
              >
                เข้าสู่ระบบ
              </Link>
            </div>
          ) : (
            <form onSubmit={handleJoin}>
              <label className="block text-gray-400 text-xs mb-1.5">ชื่อที่นั่ง (ตามที่ GM กำหนด)</label>
              <input
                type="text"
                value={seatName}
                onChange={(e) => setSeatName(e.target.value)}
                placeholder="เช่น 1, วิส, Player A"
                className="w-full bg-gray-800 border-2 border-gray-600 focus:border-yellow-400 text-white rounded-xl px-4 py-3 mb-4 outline-none transition-colors"
                maxLength={30}
              />
              {joinError && <p className="text-red-400 text-sm mb-3">{joinError}</p>}
              <button
                type="submit"
                disabled={joining || !seatName.trim()}
                className="w-full bg-yellow-500 text-black font-bold py-4 rounded-xl text-lg disabled:opacity-40"
              >
                {joining ? "กำลัง Join..." : "🐺 Join ห้อง"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
