"use client";

import { use, useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

interface RoomInfo {
  code: string;
  isOpen: boolean;
  playerCount: number;
  gmName: string;
}

interface AlivePlayer {
  userId: number;
  name: string;
}

interface GameState {
  phase: string;
  role: string | null;
  team: string | null;
  status: string | null;
  currentStep: string | null;
  isMyTurn: boolean;
  canAct: boolean;
  canVote: boolean;
  hasActed: boolean;
  hasVoted: boolean;
  winTeam: string | null;
  isWin: boolean | null;
  alivePlayers: AlivePlayer[];
  nightNumber: number;
  dayNumber: number;
}

const TEAM_STYLES: Record<string, { chip: string; emoji: string }> = {
  wolf:    { chip: "bg-red-900/60 text-red-300 border-red-700",    emoji: "🐺" },
  village: { chip: "bg-blue-900/60 text-blue-300 border-blue-700", emoji: "🏘️" },
  indy:    { chip: "bg-green-900/60 text-green-300 border-green-700", emoji: "🟢" },
  vampire: { chip: "bg-purple-900/60 text-purple-300 border-purple-700", emoji: "🧛" },
};

function ActionButton({ label, loading, onClick, disabled }: {
  label: string; loading: boolean; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full bg-yellow-500 text-black font-bold py-4 rounded-xl text-base disabled:opacity-40 mt-3"
    >
      {loading ? "กำลังส่ง..." : label}
    </button>
  );
}

export default function JoinRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { data: session, status } = useSession();

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [roomError, setRoomError] = useState("");
  const [seatName, setSeatName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [gameState, setGameState] = useState<GameState | null>(null);

  // Night action / vote state
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const poll = useCallback(() => {
    fetch(`/api/werewolf/sessions/${code}/me`)
      .then((r) => r.json())
      .then((data: GameState) => {
        setGameState((prev) => {
          // Reset target selection when entering new night/day
          if (prev && (prev.nightNumber !== data.nightNumber || prev.dayNumber !== data.dayNumber)) {
            setSelectedTarget(null);
            setActionMsg("");
          }
          return data;
        });
      })
      .catch(() => {});
  }, [code]);

  useEffect(() => {
    if (!joined || !session?.user) return;
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [joined, session, poll]);

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

  async function submitAction() {
    setSubmitting(true);
    setActionMsg("");
    try {
      const res = await fetch(`/api/werewolf/sessions/${code}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: selectedTarget }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg("✅ ส่งแล้ว! รอ GM ดำเนินการต่อ");
        setSelectedTarget(null);
        poll();
      } else {
        setActionMsg(data.error || "เกิดข้อผิดพลาด");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitVote() {
    if (!selectedTarget) return;
    setSubmitting(true);
    setActionMsg("");
    try {
      const res = await fetch(`/api/werewolf/sessions/${code}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: selectedTarget }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg("✅ โหวตแล้ว! รอผลการโหวต");
        setSelectedTarget(null);
        poll();
      } else {
        setActionMsg(data.error || "เกิดข้อผิดพลาด");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const gs = gameState;
  const teamStyle = TEAM_STYLES[gs?.team ?? "village"] ?? TEAM_STYLES.village;
  const thaiRole = gs?.role?.split(" (")[0] ?? "";
  const engRole  = gs?.role?.match(/\(([^)]+)\)/)?.[1] ?? "";
  const isDead   = gs?.status === "dead";

  // Voting targets: exclude self
  const myUserId = session?.user?.id ? Number(session.user.id) : null;
  const voteTargets = gs?.alivePlayers?.filter((p) => p.userId !== myUserId) ?? [];

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center p-6">

      {/* Fixed role chip — always visible when playing */}
      {joined && gs?.role && (
        <div className={`fixed top-3 right-3 z-50 border px-3 py-1.5 rounded-2xl shadow-lg flex items-start gap-1.5 max-w-[180px] ${teamStyle.chip} ${isDead ? "opacity-50" : ""}`}>
          <span className="text-base mt-0.5 shrink-0">{teamStyle.emoji}</span>
          <span>
            <span className="block text-xs font-bold leading-tight">{thaiRole}</span>
            {engRole && <span className="block text-[10px] opacity-70 leading-tight">{engRole}</span>}
            {isDead && <span className="block text-[10px] text-red-400 leading-tight">💀 ตายแล้ว</span>}
          </span>
        </div>
      )}

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
        /* ── Game View ── */
        <div className="w-full max-w-xs text-center">

          {/* Dead player overlay */}
          {isDead && gs?.phase === "PLAYING" && (
            <div className="mb-6">
              <p className="text-5xl mb-3">💀</p>
              <h2 className="text-red-400 text-xl font-bold mb-1">คุณตายแล้ว</h2>
              <p className="text-gray-500 text-sm">คุณต้องหลับตาและเงียบ<br />รอดูผลเกม</p>
            </div>
          )}

          {!gs || (!gs.role && gs.phase === "SETUP") ? (
            <div>
              <p className="text-5xl mb-4 animate-pulse">🐺</p>
              <h2 className="text-white text-xl font-bold mb-2">Join แล้ว!</h2>
              <p className="text-gray-300 mb-1">ห้อง <span className="text-yellow-400 font-bold tracking-widest">{code}</span></p>
              <p className="text-gray-400 text-sm mb-6">GM: {room.gmName}</p>
              <p className="text-gray-500 text-sm">รอ GM แจกไพ่...</p>
            </div>
          ) : gs.role && gs.phase === "SETUP" ? (
            <div>
              <p className="text-5xl mb-4">🃏</p>
              <h2 className="text-white text-xl font-bold mb-2">ได้รับไพ่แล้ว!</h2>
              <p className="text-gray-400 text-sm mb-3">ดูบทบาทที่มุมขวาบน และรอ GM เริ่มเกม</p>
              <p className="text-gray-600 text-xs">อย่าเปิดเผยบทบาทของคุณ 🤫</p>
            </div>
          ) : gs.phase === "ENDED" ? (
            <div>
              {gs.isWin ? (
                <>
                  <p className="text-6xl mb-4">🏆</p>
                  <h2 className="text-yellow-400 text-2xl font-bold mb-2">คุณชนะ!</h2>
                </>
              ) : (
                <>
                  <p className="text-6xl mb-4">💀</p>
                  <h2 className="text-gray-400 text-2xl font-bold mb-2">คุณแพ้...</h2>
                </>
              )}
              {gs.role && (
                <div className={`inline-flex items-center gap-2 border px-4 py-2 rounded-2xl mt-2 mb-4 ${teamStyle.chip}`}>
                  <span className="text-lg">{teamStyle.emoji}</span>
                  <span>
                    <span className="block text-sm font-bold leading-tight">{thaiRole}</span>
                    {engRole && <span className="block text-xs opacity-70 leading-tight">{engRole}</span>}
                  </span>
                </div>
              )}
              <p className="text-gray-500 text-sm">เกมจบแล้ว ขอบคุณที่เล่น!</p>
            </div>
          ) : isDead ? null : gs.canVote ? (
            /* ── Voting phase ── */
            <div className="text-left">
              <div className="text-center mb-5">
                <p className="text-5xl mb-2">🗳️</p>
                <h2 className="text-yellow-400 text-xl font-bold">เวลาโหวต!</h2>
                <p className="text-gray-400 text-sm mt-1">เลือกผู้เล่นที่คิดว่าเป็นหมาป่า</p>
              </div>
              {gs.hasVoted ? (
                <div className="text-center">
                  <p className="text-4xl mb-2">✅</p>
                  <p className="text-green-400 font-bold">โหวตแล้ว</p>
                  <p className="text-gray-500 text-sm mt-1">รอผลการโหวต...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-2">
                    {voteTargets.map((p) => (
                      <button
                        key={p.userId}
                        onClick={() => setSelectedTarget(selectedTarget === p.userId ? null : p.userId)}
                        className={`w-full px-4 py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                          selectedTarget === p.userId
                            ? "bg-yellow-500 text-black border-yellow-500"
                            : "bg-gray-800 text-white border-gray-700 hover:border-yellow-600"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  {actionMsg && <p className="text-sm text-center mt-2 text-red-400">{actionMsg}</p>}
                  <ActionButton
                    label={`🗳️ โหวต ${selectedTarget ? (voteTargets.find((p) => p.userId === selectedTarget)?.name ?? "") : ""}`}
                    loading={submitting}
                    disabled={!selectedTarget}
                    onClick={submitVote}
                  />
                </>
              )}
            </div>
          ) : gs.canAct ? (
            /* ── Night action phase ── */
            <div className="text-left">
              <div className="text-center mb-5">
                <p className="text-5xl mb-2 animate-bounce">⚡</p>
                <h2 className="text-yellow-400 text-xl font-bold animate-pulse">ถึงคิวคุณแล้ว!</h2>
                <p className="text-gray-300 text-sm mt-1">{thaiRole}</p>
              </div>
              {gs.hasActed ? (
                <div className="text-center">
                  <p className="text-4xl mb-2">✅</p>
                  <p className="text-green-400 font-bold">ส่งคำสั่งแล้ว</p>
                  <p className="text-gray-500 text-sm mt-1">รอ GM ดำเนินการต่อ...</p>
                </div>
              ) : (
                <>
                  <p className="text-gray-400 text-xs mb-3">เลือกเป้าหมาย (ถ้ามี)</p>
                  <div className="space-y-2 mb-2">
                    {gs.alivePlayers
                      .filter((p) => p.userId !== myUserId)
                      .map((p) => (
                        <button
                          key={p.userId}
                          onClick={() => setSelectedTarget(selectedTarget === p.userId ? null : p.userId)}
                          className={`w-full px-4 py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                            selectedTarget === p.userId
                              ? "bg-yellow-500 text-black border-yellow-500"
                              : "bg-gray-800 text-white border-gray-700 hover:border-yellow-600"
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                  </div>
                  {actionMsg && <p className="text-sm text-center mt-2 text-red-400">{actionMsg}</p>}
                  <ActionButton
                    label="⚡ ยืนยันการกระทำ"
                    loading={submitting}
                    disabled={false}
                    onClick={submitAction}
                  />
                  <button
                    onClick={() => { setSelectedTarget(null); submitAction(); }}
                    className="w-full text-gray-500 text-xs mt-2 py-2"
                    disabled={submitting}
                  >
                    ข้ามรอบนี้ (ไม่เลือกเป้าหมาย)
                  </button>
                </>
              )}
            </div>
          ) : gs.isMyTurn ? (
            /* Turn active but already acted */
            <div>
              <p className="text-5xl mb-4">✅</p>
              <h2 className="text-green-400 text-xl font-bold mb-2">ส่งแล้ว!</h2>
              <p className="text-gray-400 text-sm">รอ GM ดำเนินการต่อ</p>
            </div>
          ) : gs.currentStep?.startsWith("☀️") ? (
            <div>
              <p className="text-5xl mb-4">☀️</p>
              <h2 className="text-white text-xl font-bold">กลางวัน</h2>
              <p className="text-gray-400 text-sm mt-2">อภิปรายกัน!</p>
            </div>
          ) : gs.currentStep?.includes("🗳️") ? (
            /* Voting open but already voted */
            <div>
              <p className="text-5xl mb-4">✅</p>
              <h2 className="text-white text-xl font-bold mb-2">โหวตแล้ว</h2>
              <p className="text-gray-400 text-sm">รอผลการโหวต...</p>
            </div>
          ) : (
            /* Night — not your turn */
            <div>
              <p className="text-5xl mb-4">🌙</p>
              <h2 className="text-white text-xl font-bold">หลับตา...</h2>
              <p className="text-gray-500 text-sm mt-2">รอให้ GM เรียกบทบาทของคุณ</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Pre-join form ── */
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
