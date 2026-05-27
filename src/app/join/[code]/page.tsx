"use client";

import { use, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { roleDescriptions, stepToRoles } from "@/lib/werewolf-roles";

const FB_URL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "";

interface RoomInfo { code: string; isOpen: boolean; playerCount: number; gmName: string }
interface AlivePlayer { userId: number; name: string }

// Secret per-player data from /me. Only role/team/status — everything else is real-time via Firebase.
interface MyInfo {
  role: string | null;
  team: string | null;
  status: string | null;
}

// Live game state from Firebase
interface FbState {
  phase: string;
  currentStep: string | null;
  timeOfDay?: "intro" | "night" | "day" | "vote" | null;
  nightNumber: number;
  dayNumber: number;
  winTeam: string | null;
  playerNames: Record<string, string>;
  players: Record<string, { status: string; hasActed: boolean; hasVoted: boolean; voteCount: number }>;
  announcement?: string | null;
  voteDecision?: { yes: number; no: number; voters: Record<string, boolean> } | null;
}

const TEAM_STYLES: Record<string, { chip: string; emoji: string }> = {
  wolf:    { chip: "bg-red-900/60 text-red-300 border-red-700",       emoji: "🐺" },
  village: { chip: "bg-blue-900/60 text-blue-300 border-blue-700",    emoji: "🏘️" },
  indy:    { chip: "bg-green-900/60 text-green-300 border-green-700", emoji: "🟢" },
  vampire: { chip: "bg-purple-900/60 text-purple-300 border-purple-700", emoji: "🧛" },
};

export default function JoinRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { data: session, status } = useSession();

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [roomError, setRoomError] = useState("");
  const [seatName, setSeatName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Private data from /me (fetched once)
  const [myInfo, setMyInfo] = useState<MyInfo | null>(null);
  // Live state from Firebase
  const [fb, setFb] = useState<FbState | null>(null);

  // Night action / vote
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [checkResult, setCheckResult] = useState<{ role: string; team: string; targetName: string } | null>(null);

  // Role card visibility + description modal
  const [roleHidden, setRoleHidden] = useState(false);
  const [showRoleDesc, setShowRoleDesc] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const prevNightRef = useRef<number>(0);
  const prevDayRef = useRef<number>(0);
  const prevPhaseRef = useRef<string | null>(null);

  // ── Room info ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/werewolf/rooms/${code}`)
      .then((r) => r.json())
      .then((data) => { if (data.error) setRoomError(data.error); else setRoom(data); })
      .catch(() => setRoomError("เกิดข้อผิดพลาด"));
  }, [code]);

  useEffect(() => {
    if (session?.user?.firstName) setSeatName(session.user.firstName);
  }, [session]);

  // ── Fetch secret role/team from /me (only when needed) ────────────────
  const fetchMyInfo = useCallback(() => {
    fetch(`/api/werewolf/sessions/${code}/me`)
      .then((r) => r.json())
      .then((data) => setMyInfo(data as MyInfo))
      .catch(() => {});
  }, [code]);

  // ── Fetch role once on join ───────────────────────────────────────────
  useEffect(() => {
    if (joined && session?.user) fetchMyInfo();
  }, [joined, session, fetchMyInfo]);

  // ── Firebase EventSource — real-time source of truth ──────────────────
  useEffect(() => {
    if (!joined || !session?.user || !FB_URL) return;

    // Re-fetch the secret role only when GM deals/re-deals (phase=SETUP) or on a
    // phase transition. During PLAYING the role never changes, so /me is never hit.
    function maybeRefetchRole(newPhase: string | undefined) {
      if (!newPhase) return;
      if (newPhase === "SETUP" || newPhase !== prevPhaseRef.current) fetchMyInfo();
      prevPhaseRef.current = newPhase;
    }

    function connect() {
      if (esRef.current) esRef.current.close();
      const es = new EventSource(`${FB_URL}/werewolf/sessions/${code}.json`);
      esRef.current = es;

      function applyPut(raw: string) {
        try {
          const { data } = JSON.parse(raw) as { path: string; data: FbState | null };
          if (data) { setFb(data); maybeRefetchRole(data.phase); }
        } catch {}
      }

      function applyPatch(raw: string) {
        try {
          const { data } = JSON.parse(raw) as { path: string; data: Partial<FbState> };
          setFb((prev) => (prev ? { ...prev, ...data } : null));
          if (data.phase !== undefined) maybeRefetchRole(data.phase);
        } catch {}
      }

      es.addEventListener("put", (e) => applyPut((e as MessageEvent).data));
      es.addEventListener("patch", (e) => applyPatch((e as MessageEvent).data));
      es.onerror = () => { es.close(); setTimeout(connect, 3000); };
    }

    connect();
    return () => { esRef.current?.close(); esRef.current = null; };
  }, [joined, session, code, fetchMyInfo]);

  // Reset target/action message when night or day number changes (from Firebase).
  // Also re-fetch role: a night may change it (Cursed → wolf, Doppelganger swap, etc.).
  useEffect(() => {
    if (!fb) return;
    if (fb.nightNumber !== prevNightRef.current || fb.dayNumber !== prevDayRef.current) {
      setSelectedTarget(null);
      setActionMsg("");
      setVoteDecisionSent(false);
      prevNightRef.current = fb.nightNumber;
      prevDayRef.current = fb.dayNumber;
      fetchMyInfo();
    }
  }, [fb?.nightNumber, fb?.dayNumber, fb, fetchMyInfo]);

  // Reset voteDecisionSent when step leaves vote-decision phase
  useEffect(() => {
    if (!fb?.currentStep?.includes("❓")) setVoteDecisionSent(false);
  }, [fb?.currentStep]);

  // Clear any stale selection/message whenever the step changes, so a new night/role call
  // (e.g. night 2) always starts with a fresh target picker instead of last night's state (#9).
  useEffect(() => {
    setSelectedTarget(null);
    setActionMsg("");
  }, [fb?.currentStep]);

  // ── Join ─────────────────────────────────────────────────────────────
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
      if (res.ok || data.alreadyJoined) setJoined(true);
      else setJoinError(data.error || "เกิดข้อผิดพลาด");
    } finally { setJoining(false); }
  }

  // ── Night action ─────────────────────────────────────────────────────
  async function submitAction() {
    setSubmitting(true); setActionMsg("");
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
        if (data.checkResult) setCheckResult(data.checkResult);
      } else setActionMsg(data.error || "เกิดข้อผิดพลาด");
    } finally { setSubmitting(false); }
  }

  // ── Vote ─────────────────────────────────────────────────────────────
  async function submitVote() {
    if (!selectedTarget) return;
    setSubmitting(true); setActionMsg("");
    try {
      const res = await fetch(`/api/werewolf/sessions/${code}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: selectedTarget }),
      });
      const data = await res.json();
      if (res.ok) { setActionMsg("✅ โหวตแล้ว! รอผลการโหวต"); setSelectedTarget(null); }
      else setActionMsg(data.error || "เกิดข้อผิดพลาด");
    } finally { setSubmitting(false); }
  }

  // ── Identify ──────────────────────────────────────────────────────────
  async function sendIdentify() {
    await fetch(`/api/werewolf/sessions/${code}/identify`, { method: "POST" });
  }

  // ── Vote decision (YES/NO on execution) ───────────────────────────────
  const [voteDecisionSent, setVoteDecisionSent] = useState(false);
  async function submitVoteDecision(vote: "yes" | "no") {
    setVoteDecisionSent(true);
    await fetch(`/api/werewolf/sessions/${code}/vote-decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote }),
    });
  }

  // ── Derived state — Firebase is the real-time source; /me supplies secret role/team ──
  const myUserId = session?.user?.id ? Number(session.user.id) : null;
  const myUidStr = myUserId ? String(myUserId) : null;

  const role = myInfo?.role ?? null;
  const team = myInfo?.team ?? null;

  const phase       = fb?.phase       ?? "SETUP";
  const currentStep = fb?.currentStep ?? null;
  const winTeam     = fb?.winTeam     ?? null;
  const myStatus    = myUidStr ? (fb?.players[myUidStr]?.status ?? myInfo?.status ?? "alive") : "alive";
  const hasActed    = myUidStr ? (fb?.players[myUidStr]?.hasActed ?? false) : false;
  const hasVoted    = myUidStr ? (fb?.players[myUidStr]?.hasVoted ?? false) : false;
  const isDead      = myStatus === "dead";

  // isMyTurn computed client-side from the live step + cached role (stepToRoles is pure data)
  const isMyTurn = useMemo(() => {
    if (phase !== "PLAYING" || !currentStep || !role || isDead) return false;
    for (const [stepKey, roles] of Object.entries(stepToRoles)) {
      if (currentStep.includes(stepKey) || roles.some((r) => currentStep.includes(r.split(" (")[0]))) {
        if (roles.includes(role)) return true;
      }
    }
    return false;
  }, [phase, currentStep, role, isDead]);

  // Time of day: prefer the explicit flag from the canvas; fall back to step text.
  const timeOfDay: "intro" | "night" | "day" | "vote" =
    fb?.timeOfDay ??
    (currentStep?.startsWith("☀️") ? "day"
      : currentStep?.includes("🗳️") ? "vote"
      : currentStep?.includes("แนะนำตัว") ? "intro"
      : "night");

  // GM-manual mode: the GM controls and records everything on the canvas. Player phones are a
  // passive view (role + alive/dead + flow status) with no action/vote buttons. Flip to false to
  // re-enable phone-driven actions/voting.
  const GM_MANUAL_MODE = true;

  const isVotingPhase = currentStep?.includes("🗳️") ?? false;
  const canAct  = !GM_MANUAL_MODE && isMyTurn && !hasActed && !isDead;
  const canVote = !GM_MANUAL_MODE && isVotingPhase && !hasVoted && !isDead;
  const isWin   = phase === "ENDED" && winTeam && team ? team === winTeam : null;
  const announcement = fb?.announcement ?? null;
  const voteDecision = fb?.voteDecision ?? null;
  const isVoteDecisionPhase = currentStep?.includes("❓") ?? false;
  const myVoteDecisionCast = myUidStr ? (voteDecision?.voters?.[myUidStr] !== undefined) : false;

  // Alive players from Firebase (has names). Exclude self so the list never shows the player.
  const alivePlayers: AlivePlayer[] = fb
    ? Object.entries(fb.players)
        .filter(([uid, p]) => p.status !== "dead" && uid !== myUidStr)
        .map(([uid]) => ({ userId: Number(uid), name: fb.playerNames[uid] ?? `User ${uid}` }))
    : [];
  const teamStyle = TEAM_STYLES[team ?? "village"] ?? TEAM_STYLES.village;
  const thaiRole = role?.split(" (")[0] ?? "";
  const engRole  = role?.match(/\(([^)]+)\)/)?.[1] ?? "";
  const myName   = (myUidStr && fb?.playerNames?.[myUidStr]) || seatName || session?.user?.firstName || "";

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center p-6">

      {/* Own name chip — always visible while joined so each player sees who they are */}
      {joined && myName && (
        <div className="fixed top-3 left-3 z-50 bg-gray-800/90 border border-gray-600 rounded-full px-3 py-1.5 shadow-lg">
          <span className="text-[10px] text-gray-400">คุณคือ </span>
          <span className="text-sm font-bold text-yellow-400">{myName}</span>
        </div>
      )}

      {/* Role card — bottom center (tap to hide/show) */}
      {joined && role && (
        roleHidden ? (
          <button
            onClick={() => setRoleHidden(false)}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800/90 border border-gray-600 text-white text-xs px-4 py-2 rounded-2xl shadow-lg"
          >
            🎴 ดูไพ่
          </button>
        ) : (
          <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 border rounded-2xl shadow-lg min-w-[160px] ${teamStyle.chip} ${isDead ? "opacity-50" : ""}`}>
            <div className="flex items-start gap-1.5 px-4 py-2">
              <span className="text-base mt-0.5 shrink-0">{teamStyle.emoji}</span>
              <span className="flex-1">
                <span className="block text-sm font-bold leading-tight">{thaiRole}</span>
                {engRole && <span className="block text-[10px] opacity-70 leading-tight">{engRole}</span>}
                {isDead && <span className="block text-[10px] text-red-400 leading-tight">💀 ตายแล้ว</span>}
              </span>
            </div>
            <div className="flex border-t border-white/10">
              <button onClick={() => setShowRoleDesc(true)} className="flex-1 text-[11px] py-1.5 hover:bg-white/10 rounded-bl-2xl">
                ความสามารถ
              </button>
              <button onClick={() => setRoleHidden(true)} className="flex-1 text-[11px] py-1.5 hover:bg-white/10 rounded-br-2xl border-l border-white/10">
                ซ่อน
              </button>
            </div>
          </div>
        )
      )}

      {/* Role description modal */}
      {showRoleDesc && role && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-end justify-center p-4" onClick={() => setShowRoleDesc(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className={`inline-flex items-center gap-2 border px-3 py-1.5 rounded-xl mb-4 ${teamStyle.chip}`}>
              <span>{teamStyle.emoji}</span>
              <span>
                <span className="block text-sm font-bold">{thaiRole}</span>
                {engRole && <span className="block text-xs opacity-70">{engRole}</span>}
              </span>
            </div>
            <p className="text-gray-200 text-sm leading-relaxed">
              {roleDescriptions[role] ?? "ไม่มีข้อมูลความสามารถ"}
            </p>
            <button onClick={() => setShowRoleDesc(false)} className="mt-5 w-full bg-gray-700 text-white font-bold py-3 rounded-xl text-sm">
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Seer check result modal */}
      {checkResult && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-6" onClick={() => setCheckResult(null)}>
          <div className="bg-gray-900 border border-yellow-600 rounded-2xl w-full max-w-xs p-6 text-center" onClick={e => e.stopPropagation()}>
            <p className="text-4xl mb-3">🔍</p>
            <h3 className="text-yellow-400 font-bold text-lg mb-1">ผลการส่อง</h3>
            <p className="text-gray-300 text-sm mb-4">{checkResult.targetName}</p>
            <div className={`inline-flex items-center gap-2 border px-4 py-2 rounded-xl mb-5 ${TEAM_STYLES[checkResult.team]?.chip ?? "bg-gray-800 text-white border-gray-600"}`}>
              <span className="text-lg">{TEAM_STYLES[checkResult.team]?.emoji ?? "🎭"}</span>
              <span>
                <span className="block text-sm font-bold leading-tight">{checkResult.role.split(" (")[0]}</span>
                {checkResult.role.match(/\(([^)]+)\)/)?.[1] && (
                  <span className="block text-[10px] opacity-70 leading-tight">{checkResult.role.match(/\(([^)]+)\)/)?.[1]}</span>
                )}
              </span>
            </div>
            <button onClick={() => setCheckResult(null)} className="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl text-sm">
              รับทราบ
            </button>
          </div>
        </div>
      )}

      {/* Announcement banner (top — bottom is used by the role card) */}
      {joined && announcement && phase === "PLAYING" && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-gray-900/95 border-b border-gray-600 px-4 py-3">
          <p className="text-white text-sm text-center">{announcement}</p>
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

          {/* Identify button — visible when alive and playing */}
          {phase === "PLAYING" && !isDead && (
            <button
              onClick={sendIdentify}
              className="fixed bottom-16 right-4 z-30 bg-yellow-500 text-black font-bold rounded-full w-14 h-14 text-2xl shadow-lg active:bg-yellow-400 flex items-center justify-center"
              title="กดเพื่อให้ GM ระบุตัวคุณบน Canvas"
            >
              🎯
            </button>
          )}

          {isDead && phase === "PLAYING" && (
            <div className="mb-6">
              <p className="text-5xl mb-3">💀</p>
              <h2 className="text-red-400 text-xl font-bold mb-1">คุณตายแล้ว</h2>
              <p className="text-gray-500 text-sm">คุณต้องหลับตาและเงียบ<br />รอดูผลเกม</p>
            </div>
          )}

          {/* Standby — role was cleared (GM reset), waiting for new deal */}
          {phase === "PLAYING" && !role && (
            <div className="text-center">
              <p className="text-5xl mb-4 animate-pulse">⏳</p>
              <h2 className="text-white text-xl font-bold mb-2">รอรอบใหม่</h2>
              <p className="text-gray-400 text-sm">GM กำลังเตรียมการ์ดรอบถัดไป...</p>
            </div>
          )}

          {phase === "SETUP" && !role ? (
            <div>
              <p className="text-5xl mb-4 animate-pulse">🐺</p>
              <h2 className="text-white text-xl font-bold mb-2">Join แล้ว!</h2>
              <p className="text-gray-300 mb-1">ห้อง <span className="text-yellow-400 font-bold tracking-widest">{code}</span></p>
              <p className="text-gray-400 text-sm mb-6">GM: {room.gmName}</p>
              <p className="text-gray-500 text-sm">รอ GM แจกไพ่...</p>
            </div>
          ) : phase === "SETUP" && role ? (
            <div>
              <p className="text-5xl mb-4">🃏</p>
              <h2 className="text-white text-xl font-bold mb-2">ได้รับไพ่แล้ว!</h2>
              <p className="text-gray-400 text-sm mb-3">ดูบทบาทที่มุมขวาบน และรอ GM เริ่มเกม</p>
              <p className="text-gray-600 text-xs">อย่าเปิดเผยบทบาทของคุณ 🤫</p>
            </div>
          ) : phase === "ENDED" ? (
            <div>
              {isWin ? (
                <><p className="text-6xl mb-4">🏆</p><h2 className="text-yellow-400 text-2xl font-bold mb-2">คุณชนะ!</h2></>
              ) : (
                <><p className="text-6xl mb-4">💀</p><h2 className="text-gray-400 text-2xl font-bold mb-2">คุณแพ้...</h2></>
              )}
              {role && (
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
          ) : isDead ? null : isVoteDecisionPhase && !isDead && !GM_MANUAL_MODE ? (
            /* ── Vote Decision (YES/NO on execution) ── */
            <div className="text-center">
              <p className="text-5xl mb-3">🗳️</p>
              <h2 className="text-yellow-400 text-xl font-bold mb-2">จะโหวตประหารไหม?</h2>
              <p className="text-gray-400 text-sm mb-5">เสียงส่วนใหญ่ตัดสิน</p>
              {(voteDecisionSent || myVoteDecisionCast) ? (
                <div>
                  <p className="text-4xl mb-2">✅</p>
                  <p className="text-green-400 font-bold">โหวตแล้ว รอผล...</p>
                  {voteDecision && (
                    <div className="mt-3 flex gap-4 justify-center text-sm">
                      <span className="text-green-400">✅ เอา: {voteDecision.yes ?? 0}</span>
                      <span className="text-red-400">❌ ไม่เอา: {voteDecision.no ?? 0}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <button onClick={() => submitVoteDecision("yes")} className="w-full bg-green-600 text-white font-bold py-4 rounded-xl text-lg active:bg-green-500">
                    ✅ โหวต — จะประหาร
                  </button>
                  <button onClick={() => submitVoteDecision("no")} className="w-full bg-red-700 text-white font-bold py-4 rounded-xl text-lg active:bg-red-600">
                    ❌ ไม่โหวต — ข้ามไป
                  </button>
                  {voteDecision && (
                    <div className="flex gap-4 justify-center text-sm text-gray-400 mt-2">
                      <span className="text-green-400">✅ {voteDecision.yes ?? 0}</span>
                      <span className="text-red-400">❌ {voteDecision.no ?? 0}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : canVote ? (
            /* ── Voting ── */
            <div className="text-left">
              <div className="text-center mb-5">
                <p className="text-5xl mb-2">🗳️</p>
                <h2 className="text-yellow-400 text-xl font-bold">เวลาโหวต!</h2>
                <p className="text-gray-400 text-sm mt-1">เลือกผู้เล่นที่คิดว่าเป็นหมาป่า</p>
              </div>
              {hasVoted ? (
                <div className="text-center"><p className="text-4xl mb-2">✅</p><p className="text-green-400 font-bold">โหวตแล้ว</p><p className="text-gray-500 text-sm mt-1">รอผลการโหวต...</p></div>
              ) : (
                <>
                  <div className="space-y-2 mb-2">
                    {alivePlayers.map((p) => (
                      <button key={p.userId} onClick={() => setSelectedTarget(selectedTarget === p.userId ? null : p.userId)}
                        className={`w-full px-4 py-3 rounded-xl font-bold text-sm border-2 transition-all ${selectedTarget === p.userId ? "bg-yellow-500 text-black border-yellow-500" : "bg-gray-800 text-white border-gray-700 hover:border-yellow-600"}`}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                  {actionMsg && <p className="text-sm text-center mt-2 text-red-400">{actionMsg}</p>}
                  <button onClick={submitVote} disabled={!selectedTarget || submitting}
                    className="w-full bg-yellow-500 text-black font-bold py-4 rounded-xl text-base disabled:opacity-40 mt-3">
                    {submitting ? "กำลังส่ง..." : `🗳️ โหวต ${selectedTarget ? (alivePlayers.find((p) => p.userId === selectedTarget)?.name ?? "") : ""}`}
                  </button>
                </>
              )}
            </div>
          ) : canAct ? (
            /* ── Night action ── */
            <div className="text-left">
              <div className="text-center mb-5">
                <p className="text-5xl mb-2 animate-bounce">⚡</p>
                <h2 className="text-yellow-400 text-xl font-bold animate-pulse">ถึงคิวคุณแล้ว!</h2>
                <p className="text-gray-300 text-sm mt-1">{thaiRole}</p>
              </div>
              {hasActed ? (
                <div className="text-center"><p className="text-4xl mb-2">✅</p><p className="text-green-400 font-bold">ส่งคำสั่งแล้ว</p><p className="text-gray-500 text-sm mt-1">รอ GM ดำเนินการต่อ...</p></div>
              ) : (
                <>
                  <p className="text-gray-400 text-xs mb-3">เลือกเป้าหมาย (ถ้ามี)</p>
                  <div className="space-y-2 mb-2">
                    {alivePlayers.map((p) => (
                      <button key={p.userId} onClick={() => setSelectedTarget(selectedTarget === p.userId ? null : p.userId)}
                        className={`w-full px-4 py-3 rounded-xl font-bold text-sm border-2 transition-all ${selectedTarget === p.userId ? "bg-yellow-500 text-black border-yellow-500" : "bg-gray-800 text-white border-gray-700 hover:border-yellow-600"}`}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                  {actionMsg && <p className="text-sm text-center mt-2 text-red-400">{actionMsg}</p>}
                  <button onClick={submitAction} disabled={submitting}
                    className="w-full bg-yellow-500 text-black font-bold py-4 rounded-xl text-base disabled:opacity-40 mt-3">
                    {submitting ? "กำลังส่ง..." : "⚡ ยืนยันการกระทำ"}
                  </button>
                  <button onClick={() => { setSelectedTarget(null); submitAction(); }} disabled={submitting}
                    className="w-full text-gray-500 text-xs mt-2 py-2">
                    ข้ามรอบนี้ (ไม่เลือกเป้าหมาย)
                  </button>
                </>
              )}
            </div>
          ) : timeOfDay === "day" ? (
            <div><p className="text-5xl mb-4">☀️</p><h2 className="text-white text-xl font-bold">กลางวัน</h2><p className="text-gray-400 text-sm mt-2">อภิปรายกัน!</p></div>
          ) : timeOfDay === "vote" ? (
            <div><p className="text-5xl mb-4">🗳️</p><h2 className="text-white text-xl font-bold mb-2">ช่วงโหวต</h2><p className="text-gray-400 text-sm">โหวตตามที่ GM กำหนด</p></div>
          ) : timeOfDay === "intro" ? (
            <div><p className="text-5xl mb-4">📣</p><h2 className="text-white text-xl font-bold">เริ่มเกม</h2><p className="text-gray-400 text-sm mt-2">รอ GM แนะนำตัว...</p></div>
          ) : (
            <div><p className="text-5xl mb-4">🌙</p><h2 className="text-white text-xl font-bold">หลับตา...</h2><p className="text-gray-500 text-sm mt-2">รอให้ GM เรียกบทบาทของคุณ</p></div>
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
              <Link href={`/login?callbackUrl=/join/${code}`} className="block w-full bg-yellow-500 text-black font-bold py-3.5 rounded-xl text-center">เข้าสู่ระบบ</Link>
            </div>
          ) : (
            <form onSubmit={handleJoin}>
              <label className="block text-gray-400 text-xs mb-1.5">ชื่อที่นั่ง (ตามที่ GM กำหนด)</label>
              <input type="text" value={seatName} onChange={(e) => setSeatName(e.target.value)}
                placeholder="เช่น 1, วิส, Player A"
                className="w-full bg-gray-800 border-2 border-gray-600 focus:border-yellow-400 text-white rounded-xl px-4 py-3 mb-4 outline-none transition-colors" maxLength={30} />
              {joinError && <p className="text-red-400 text-sm mb-3">{joinError}</p>}
              <button type="submit" disabled={joining || !seatName.trim()}
                className="w-full bg-yellow-500 text-black font-bold py-4 rounded-xl text-lg disabled:opacity-40">
                {joining ? "กำลัง Join..." : "🐺 Join ห้อง"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
