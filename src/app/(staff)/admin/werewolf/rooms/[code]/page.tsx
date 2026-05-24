"use client";

import { useEffect, useState, use } from "react";
import useSWR from "swr";
import QRCode from "qrcode";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Player {
  id: number;
  seatName: string;
  joinedAt: string;
  user: { id: number; firstName: string; nickname: string | null; username: string };
}

const TEAMS = [
  { value: "wolf", label: "🔴 ฝ่ายหมาป่า", color: "bg-red-100 text-red-700 border-red-300" },
  { value: "village", label: "🔵 ฝ่ายชาวบ้าน", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "indy", label: "🟢 ฝ่ายอิสระ", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "vampire", label: "🟣 ฝ่ายแวมไพร์", color: "bg-purple-100 text-purple-700 border-purple-300" },
];

export default function GMRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [qrUrl, setQrUrl] = useState("");
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [winTeam, setWinTeam] = useState("village");
  const [playerRoles, setPlayerRoles] = useState<Record<number, { role: string; team: string }>>({});
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const { data: players, isLoading } = useSWR<Player[]>(
    `/api/werewolf/rooms/${code}/players`,
    fetcher,
    { refreshInterval: 5000 }
  );

  useEffect(() => {
    const joinUrl = `${window.location.origin}/join/${code}`;
    QRCode.toDataURL(joinUrl, { width: 200, margin: 2 }).then(setQrUrl);
  }, [code]);

  async function toggleRoom() {
    const newOpen = !isOpen;
    await fetch(`/api/werewolf/rooms/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: newOpen }),
    });
    setIsOpen(newOpen);
  }

  async function recordGame() {
    if (!players?.length) return;
    setSaving(true);
    try {
      const results = players.map((p) => ({
        userId: p.user.id,
        team: playerRoles[p.user.id]?.team || "village",
        role: playerRoles[p.user.id]?.role || "ชาวบ้าน (Villager)",
        isWin: (playerRoles[p.user.id]?.team || "village") === winTeam,
      }));

      const res = await fetch("/api/werewolf/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: undefined, code, winTeam, results }),
      });

      if (res.ok) {
        setShowRecordModal(false);
        alert("บันทึกผลเกมสำเร็จ!");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/werewolf" className="text-gray-400 hover:text-navy">←</Link>
        <h1 className="text-2xl font-bold text-navy">ห้อง {code}</h1>
        <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${isOpen ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {isOpen ? "เปิดอยู่" : "ปิดแล้ว"}
        </span>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4 flex flex-col items-center">
        <p className="text-xs text-gray-400 mb-1">Room Code</p>
        <p className="text-5xl font-bold tracking-[0.2em] text-navy mb-4">{code}</p>
        {qrUrl && <img src={qrUrl} alt="QR Code" className="rounded-xl border border-gray-200" />}
        <p className="text-xs text-gray-400 mt-2">/join/{code}</p>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <h2 className="font-bold text-navy mb-3">ผู้เล่นในห้อง ({players?.length ?? 0} คน)</h2>
        {isLoading ? (
          <p className="text-gray-400 text-sm">กำลังโหลด...</p>
        ) : !players?.length ? (
          <p className="text-gray-400 text-sm text-center py-4">รอผู้เล่น scan QR...</p>
        ) : (
          <div className="space-y-2">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center text-navy font-bold text-sm shrink-0">
                  {p.seatName.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-sm text-navy">{p.seatName}</p>
                  <p className="text-xs text-gray-400">{p.user.nickname || p.user.firstName}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={toggleRoom}
          className={`py-3 rounded-xl font-bold text-sm border ${isOpen ? "border-red-300 text-red-600 bg-red-50" : "border-green-300 text-green-700 bg-green-50"}`}
        >
          {isOpen ? "🔒 ปิดห้อง" : "🔓 เปิดห้อง"}
        </button>
        <button
          onClick={() => setShowRecordModal(true)}
          disabled={!players?.length}
          className="py-3 rounded-xl font-bold text-sm bg-navy text-cream disabled:opacity-40"
        >
          📋 บันทึกผลเกม
        </button>
      </div>

      {showRecordModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-navy text-lg">บันทึกผลเกม</h2>
              <button onClick={() => setShowRecordModal(false)} className="text-gray-400 text-2xl">×</button>
            </div>

            <p className="text-sm text-gray-500 mb-2 font-bold">ทีมที่ชนะ</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {TEAMS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setWinTeam(t.value)}
                  className={`py-2.5 rounded-xl text-sm font-bold border ${winTeam === t.value ? t.color : "bg-gray-50 text-gray-500 border-gray-200"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <p className="text-sm text-gray-500 mb-2 font-bold">บทบาทผู้เล่น</p>
            <div className="space-y-3 mb-5">
              {players?.map((p) => (
                <div key={p.id} className="bg-gray-50 rounded-xl p-3">
                  <p className="font-bold text-sm text-navy mb-2">{p.seatName} — {p.user.nickname || p.user.firstName}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="บทบาท เช่น หมาป่า"
                      value={playerRoles[p.user.id]?.role ?? ""}
                      onChange={(e) =>
                        setPlayerRoles((prev) => ({
                          ...prev,
                          [p.user.id]: { ...prev[p.user.id], role: e.target.value },
                        }))
                      }
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-navy"
                    />
                    <select
                      value={playerRoles[p.user.id]?.team ?? "village"}
                      onChange={(e) =>
                        setPlayerRoles((prev) => ({
                          ...prev,
                          [p.user.id]: { ...prev[p.user.id], team: e.target.value },
                        }))
                      }
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-navy"
                    >
                      <option value="wolf">หมาป่า</option>
                      <option value="village">ชาวบ้าน</option>
                      <option value="indy">อิสระ</option>
                      <option value="vampire">แวมไพร์</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={recordGame}
              disabled={saving}
              className="w-full bg-navy text-cream py-3 rounded-xl font-bold disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "✅ บันทึกผลเกม"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
