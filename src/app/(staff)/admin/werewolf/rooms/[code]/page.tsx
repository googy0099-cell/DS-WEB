"use client";

import { useEffect, useState, use, useCallback } from "react";
import useSWR from "swr";
import QRCode from "qrcode";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { wolfRoles, villagerRoles, indyRoles, vampireRoles } from "@/lib/werewolf-roles";
import { useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Player {
  id: number;
  seatName: string;
  joinedAt: string;
  user: { id: number; firstName: string; nickname: string | null; username: string };
}

interface MemberResult {
  id: number;
  username: string;
  firstName: string;
  nickname: string | null;
  memberCode: string;
}

interface Assignment {
  userId: number;
  seatName: string;
  role: string;
  team: string;
  usePhone: boolean;
}

interface SessionData {
  id: number;
  phase: string;
  playerRoles: { userId: number; role: string; team: string; seatName: string | null }[];
}

// ── Role data ──────────────────────────────────────────────────────────
const ALL_ROLES = [
  { group: "🔴 ฝ่ายหมาป่า", roles: wolfRoles },
  { group: "🔵 ฝ่ายชาวบ้าน", roles: villagerRoles },
  { group: "🟢 ฝ่ายอิสระ", roles: indyRoles },
  { group: "🟣 ฝ่ายแวมไพร์", roles: vampireRoles },
];

const DECOY_ROLE_KEYS = [
  "WolfPack", "บอดี้การ์ด_นักบวช", "หมอดู_นักสืบ", "บล็อบจอมเขมือบ_แมรี่",
  "แม่มด (Witch)", "พรานหญิง (Huntress)", "แวมไพร์ (Vampire)",
  "นักเป่าขลุ่ย (Piper)", "ซอมบี้ (Zombie)", "เจ้าลัทธิ (Cult Leader)",
  "กามเทพ (Cupid)", "ร่างโคลน (Doppelganger)",
];

const FAV_KEY = "werewolf_fav_roles";

const TEAM_CHIP: Record<string, string> = {
  wolf:    "bg-red-100 text-red-700 border-red-200",
  village: "bg-blue-100 text-blue-700 border-blue-200",
  indy:    "bg-green-100 text-green-700 border-green-200",
  vampire: "bg-purple-100 text-purple-700 border-purple-200",
};
const TEAM_LABEL: Record<string, string> = {
  wolf: "หมาป่า", village: "ชาวบ้าน", indy: "อิสระ", vampire: "แวมไพร์",
};

// ── Main inner component ───────────────────────────────────────────────
function GMRoomInner({ code }: { code: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [qrUrl, setQrUrl] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  // Modals
  const [showSeatModal, setShowSeatModal]   = useState(false);
  const [showRoleModal, setShowRoleModal]   = useState(false);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Role selection
  const [selectedRoles, setSelectedRoles]   = useState<string[]>([]);
  const [selectedDecoys, setSelectedDecoys] = useState<string[]>([]);
  const [roleStep, setRoleStep]             = useState<"roles" | "decoys">("roles");
  const [favRoles, setFavRoles]             = useState<string[]>([]);

  // Seat manager state
  const [seatEdits, setSeatEdits]       = useState<Record<number, string>>({});
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<MemberResult[]>([]);
  const [addingSeat, setAddingSeat]     = useState("");
  const [addingUserId, setAddingUserId] = useState<number | null>(null);
  const [savingSeats, setSavingSeats]   = useState(false);

  // Session state
  const [assignments, setAssignments]   = useState<Assignment[] | null>(null);
  const [phoneFlags, setPhoneFlags]     = useState<Record<number, boolean>>({});
  const [startingSession, setStartingSession] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [deletingRoom, setDeletingRoom] = useState(false);

  const { data: players, mutate: mutatePlayers } = useSWR<Player[]>(
    `/api/werewolf/rooms/${code}/players`,
    fetcher,
    { refreshInterval: 5000 }
  );

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAV_KEY);
      if (saved) setFavRoles(JSON.parse(saved));
    } catch {}
  }, []);

  // Generate QR
  useEffect(() => {
    const joinUrl = `${window.location.origin}/join/${code}`;
    QRCode.toDataURL(joinUrl, { width: 200, margin: 2 }).then(setQrUrl);
  }, [code]);

  // Load existing session
  useEffect(() => {
    fetch(`/api/werewolf/sessions/${code}`)
      .then((r) => r.json())
      .then((s: SessionData) => {
        if (s?.playerRoles?.length) {
          const loaded: Assignment[] = s.playerRoles.map((sp) => ({
            userId: sp.userId,
            seatName: sp.seatName ?? `User ${sp.userId}`,
            role: sp.role,
            team: sp.team,
            usePhone: true,
          }));
          setAssignments(loaded);
          const flags: Record<number, boolean> = {};
          loaded.forEach((a) => { flags[a.userId] = true; });
          setPhoneFlags(flags);
          if (searchParams.get("check") === "1") setShowCheckModal(true);
        }
      })
      .catch(() => {});
  }, [code, searchParams]);

  // Sync seat edits when players load
  useEffect(() => {
    if (players) {
      const edits: Record<number, string> = {};
      players.forEach((p) => { edits[p.user.id] = p.seatName; });
      setSeatEdits(edits);
    }
  }, [players]);

  // Member search
  const searchMembers = useCallback(async (q: string) => {
    if (q.length < 2) { setMemberResults([]); return; }
    const res = await fetch(`/api/members?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setMemberResults(data.slice(0, 5));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchMembers(memberSearch), 300);
    return () => clearTimeout(t);
  }, [memberSearch, searchMembers]);

  // ── Handlers ──────────────────────────────────────────────────────────

  async function toggleRoom() {
    const newOpen = !isOpen;
    await fetch(`/api/werewolf/rooms/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: newOpen }),
    });
    setIsOpen(newOpen);
  }

  async function saveSeats() {
    setSavingSeats(true);
    const updates = Object.entries(seatEdits).map(([uid, seatName]) => ({
      userId: Number(uid),
      seatName,
    }));
    await fetch(`/api/werewolf/rooms/${code}/players`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    await mutatePlayers();
    setSavingSeats(false);
    setShowSeatModal(false);
  }

  async function addManualPlayer() {
    if (!addingUserId || !addingSeat.trim()) return;
    const res = await fetch(`/api/werewolf/rooms/${code}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: addingUserId, seatName: addingSeat.trim() }),
    });
    if (res.ok) {
      await mutatePlayers();
      setAddingUserId(null);
      setAddingSeat("");
      setMemberSearch("");
      setMemberResults([]);
    }
  }

  async function removePlayer(userId: number) {
    await fetch(`/api/werewolf/rooms/${code}/players`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    await mutatePlayers();
    setSeatEdits((prev) => { const n = { ...prev }; delete n[userId]; return n; });
  }

  function toggleFav(role: string) {
    setFavRoles((prev) => {
      const next = prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function startSession() {
    setStartingSession(true);
    setSessionError("");
    try {
      const allPlayers = players ?? [];
      const phoneOnlyPlayers = allPlayers.filter((p) => phoneFlags[p.user.id] !== false);
      const cardOnlyPlayers  = allPlayers.filter((p) => phoneFlags[p.user.id] === false);

      const res = await fetch("/api/werewolf/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: code,
          selectedRoles,
          decoyRoles: selectedDecoys,
          cardOnlyUserIds: cardOnlyPlayers.map((p) => p.user.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSessionError(data.error || "เกิดข้อผิดพลาด"); return; }

      const loaded: Assignment[] = data.assignments.map((a: { userId: number; seatName: string; role: string; team: string }) => ({
        ...a,
        usePhone: phoneFlags[a.userId] !== false,
      }));
      setAssignments(loaded);
      setShowRoleModal(false);
      setShowCheckModal(true);
    } catch {
      setSessionError("เกิดข้อผิดพลาด");
    } finally {
      setStartingSession(false);
    }
  }

  async function deleteRoom() {
    setDeletingRoom(true);
    const res = await fetch(`/api/werewolf/rooms/${code}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/werewolf");
    else setDeletingRoom(false);
  }

  // ── Computed ──────────────────────────────────────────────────────────
  const playerCount  = players?.length ?? 0;
  const roleCount    = selectedRoles.length;
  const hasSession   = !!assignments?.length;
  const favFiltered  = favRoles.filter((r) =>
    [...wolfRoles, ...villagerRoles, ...indyRoles, ...vampireRoles].includes(r)
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/werewolf" className="text-gray-400 hover:text-navy text-lg">←</Link>
        <div>
          <h1 className="text-xl font-bold text-navy leading-tight">ห้อง {code}</h1>
          <p className="text-xs text-gray-400">Werewolf GM Room</p>
        </div>
        <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full border ${isOpen ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
          {isOpen ? "● เปิดอยู่" : "○ ปิดแล้ว"}
        </span>
      </div>

      {/* QR Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4 flex flex-col items-center">
        <p className="text-4xl font-bold tracking-[0.25em] text-navy mb-3">{code}</p>
        {qrUrl && <img src={qrUrl} alt="QR Code" className="rounded-xl border border-gray-200 mb-2" />}
        <p className="text-xs text-gray-400">ผู้เล่น scan QR หรือพิมพ์ /join/{code}</p>
      </div>

      {/* Player list + Seat Manager */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-navy text-sm">ผู้เล่นในห้อง</h2>
          <div className="flex items-center gap-2">
            <span className="bg-navy text-cream text-xs font-bold px-2.5 py-0.5 rounded-full">
              {playerCount} คน
            </span>
            <button
              onClick={() => setShowSeatModal(true)}
              className="text-xs bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full hover:bg-gray-200"
            >
              🪑 จัดที่นั่ง
            </button>
          </div>
        </div>
        {!players?.length ? (
          <p className="text-gray-400 text-sm text-center py-4">รอผู้เล่น scan QR...</p>
        ) : (
          <div className="space-y-2">
            {players.map((p, i) => {
              const assign = assignments?.find((a) => a.userId === p.user.id);
              const isCard = phoneFlags[p.user.id] === false;
              return (
                <div key={p.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center text-navy font-bold text-xs shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-navy">{p.seatName}</p>
                    <p className="text-xs text-gray-400">{p.user.nickname || p.user.firstName}</p>
                  </div>
                  {isCard && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">🃏 การ์ด</span>}
                  {assign && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold border shrink-0 ${TEAM_CHIP[assign.team]}`}>
                      {assign.role.split(" (")[0]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* === SESSION ACTIVE === */}
      {hasSession ? (
        <div className="space-y-3 mb-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-bold text-green-800 text-sm">แจกไพ่แล้ว — {assignments!.length} คน</p>
              <p className="text-xs text-green-600">ผู้เล่นที่ใช้โทรศัพท์สามารถดูบทบาทได้แล้ว</p>
            </div>
          </div>

          <button
            onClick={() => setShowCheckModal(true)}
            className="w-full bg-white border-2 border-navy text-navy font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2"
          >
            🔍 ตรวจสอบบทบาท (GM View)
          </button>

          <Link
            href={`/admin/werewolf/canvas?room=${code}`}
            className="block w-full bg-navy text-cream font-bold py-5 rounded-2xl text-base text-center shadow-lg"
          >
            🖥️ เปิด GM Canvas
            <p className="text-cream/60 text-xs font-normal mt-0.5">ดำเนินเกม · Night Phase · Mark ผู้เล่น</p>
          </Link>

          <button
            onClick={() => { setRoleStep("roles"); setShowRoleModal(true); }}
            className="w-full border border-gray-200 text-gray-500 font-bold py-3 rounded-xl text-sm"
          >
            🔄 เริ่มรอบใหม่ (สุ่มบทบาทใหม่)
          </button>
        </div>
      ) : (
        /* === NO SESSION === */
        <div className="space-y-3 mb-4">
          <button
            onClick={() => { setRoleStep("roles"); setShowRoleModal(true); }}
            disabled={!playerCount}
            className="w-full bg-orange text-white font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-40 shadow-md"
          >
            🎲 เลือกบทบาท + สุ่มแจก
          </button>
          <Link
            href={`/admin/werewolf/canvas?room=${code}`}
            className="block w-full border-2 border-navy text-navy font-bold py-4 rounded-2xl text-sm text-center"
          >
            🖥️ เปิด GM Canvas (ไม่สุ่มโรล)
          </Link>
        </div>
      )}

      {/* Room controls */}
      <div className="space-y-2 mb-4">
        <button
          onClick={toggleRoom}
          className={`w-full py-3 rounded-xl font-bold text-sm border ${isOpen ? "border-red-200 text-red-600 bg-red-50" : "border-green-200 text-green-700 bg-green-50"}`}
        >
          {isOpen ? "🔒 ปิดห้อง" : "🔓 เปิดห้อง"}
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-3 rounded-xl font-bold text-sm border border-red-100 text-red-400 bg-white"
        >
          🗑️ ลบห้องนี้
        </button>
      </div>

      {/* ══════════════════════════════════════════════
          MODAL: SEAT MANAGER
      ══════════════════════════════════════════════ */}
      {showSeatModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-navy text-lg">🪑 จัดที่นั่งผู้เล่น</h2>
                  <p className="text-xs text-gray-400 mt-0.5">แก้ไขชื่อที่นั่ง · เพิ่มผู้เล่นด้วยบัตรสมาชิก</p>
                </div>
                <button onClick={() => setShowSeatModal(false)} className="text-gray-400 text-2xl leading-none">×</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {/* Existing players — edit seat names */}
              {players?.length ? (
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-2">ผู้เล่นในห้อง — แก้ไขชื่อที่นั่ง</p>
                  <div className="space-y-2">
                    {players.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400">{p.user.nickname || p.user.firstName} (@{p.user.username})</p>
                          <input
                            type="text"
                            value={seatEdits[p.user.id] ?? p.seatName}
                            onChange={(e) => setSeatEdits((prev) => ({ ...prev, [p.user.id]: e.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm font-bold text-navy mt-1 outline-none focus:border-navy"
                            placeholder="ชื่อที่นั่ง / เลขที่นั่ง"
                          />
                        </div>
                        {/* Phone / Card toggle */}
                        <button
                          onClick={() => setPhoneFlags((prev) => ({ ...prev, [p.user.id]: prev[p.user.id] === false ? true : false }))}
                          className={`shrink-0 text-xs font-bold px-2 py-1.5 rounded-lg border transition-colors ${
                            phoneFlags[p.user.id] === false
                              ? "bg-amber-100 text-amber-700 border-amber-200"
                              : "bg-blue-50 text-blue-600 border-blue-200"
                          }`}
                          title="สลับระหว่างใช้โทรศัพท์ / การ์ดจริง"
                        >
                          {phoneFlags[p.user.id] === false ? "🃏" : "📱"}
                        </button>
                        <button
                          onClick={() => removePlayer(p.user.id)}
                          className="shrink-0 text-red-400 hover:text-red-600 text-lg leading-none px-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">📱 = ใช้โทรศัพท์รับบทบาท &nbsp;|&nbsp; 🃏 = ใช้การ์ดจริง (ยังเก็บคะแนนได้)</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-2">ยังไม่มีผู้เล่น</p>
              )}

              {/* Add card player by member search */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-bold text-gray-400 mb-2">เพิ่มผู้เล่นด้วยบัตรสมาชิก (ไม่ได้ใช้โทรศัพท์)</p>
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="ค้นหาจาก username, รหัส, หรืออีเมล"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-navy mb-2"
                />
                {memberResults.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setAddingUserId(m.id); setMemberSearch(m.firstName); setMemberResults([]); }}
                    className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-navy/5 rounded-xl mb-1 text-sm"
                  >
                    <span className="font-bold text-navy">{m.firstName}</span>
                    <span className="text-gray-400 ml-2">@{m.username} · {m.memberCode}</span>
                  </button>
                ))}
                {addingUserId && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={addingSeat}
                      onChange={(e) => setAddingSeat(e.target.value)}
                      placeholder="ชื่อที่นั่ง (เช่น ที่นั่ง 3)"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-navy"
                    />
                    <button
                      onClick={addManualPlayer}
                      className="bg-navy text-cream text-sm font-bold px-4 rounded-xl"
                    >
                      เพิ่ม
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 shrink-0">
              <button
                onClick={saveSeats}
                disabled={savingSeats}
                className="w-full bg-navy text-cream py-3.5 rounded-2xl font-bold text-sm disabled:opacity-50"
              >
                {savingSeats ? "กำลังบันทึก..." : "✅ บันทึกที่นั่ง"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL: ROLE CHECK (GM VIEW)
      ══════════════════════════════════════════════ */}
      {showCheckModal && assignments && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[88vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-navy text-lg">🔍 ตรวจสอบบทบาท</h2>
                  <p className="text-xs text-gray-400 mt-0.5">GM View — ผู้เล่นไม่เห็นหน้าจอนี้</p>
                </div>
                <button onClick={() => setShowCheckModal(false)} className="text-gray-400 text-2xl leading-none">×</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {assignments.map((a) => (
                <div key={a.userId} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center text-navy font-bold shrink-0">
                    {a.seatName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-navy">{a.seatName}</p>
                    {!a.usePhone && <span className="text-xs text-amber-600">🃏 ใช้การ์ดจริง</span>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm text-navy">{a.role.split(" (")[0]}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${TEAM_CHIP[a.team]}`}>
                      {TEAM_LABEL[a.team]}
                    </span>
                  </div>
                </div>
              ))}

              {/* Team summary */}
              <div className="bg-navy/5 rounded-xl p-3 mt-2">
                <p className="text-xs font-bold text-navy mb-2">สรุปตามทีม</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["wolf", "village", "indy", "vampire"] as const).map((team) => {
                    const count = assignments.filter((a) => a.team === team).length;
                    if (!count) return null;
                    return (
                      <div key={team} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold ${TEAM_CHIP[team]}`}>
                        <span>{count} คน</span>
                        <span className="text-xs font-normal">{TEAM_LABEL[team]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 shrink-0 space-y-2">
              <p className="text-xs text-center text-gray-400">💡 แจ้งผู้เล่น (📱) ให้ดูบทบาทที่มุมขวาบนของมือถือ</p>
              <Link
                href={`/admin/werewolf/canvas?room=${code}`}
                className="flex items-center justify-center gap-2 w-full bg-navy text-cream font-bold py-4 rounded-2xl text-sm"
                onClick={() => setShowCheckModal(false)}
              >
                🖥️ เปิด GM Canvas → เริ่มเกม!
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL: ROLE SELECTION (LIST + FAVORITES)
      ══════════════════════════════════════════════ */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 shrink-0">
              <div className="flex justify-between items-center mb-1">
                <div>
                  <h2 className="font-bold text-navy text-lg">
                    {roleStep === "roles" ? "① เลือกบทบาทในเกม" : "② เลือก Decoy Roles"}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {roleStep === "roles"
                      ? `เลือกแล้ว ${roleCount} / ต้องการ ${playerCount} คน`
                      : "บทบาทที่จะเรียกหลอกระหว่างกลางคืน"
                    }
                  </p>
                </div>
                <button onClick={() => setShowRoleModal(false)} className="text-gray-400 text-2xl leading-none">×</button>
              </div>
              {roleStep === "roles" && roleCount < playerCount && (
                <p className="text-xs text-red-400 mt-1">⚠ ต้องเลือกอย่างน้อย {playerCount} บทบาท</p>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              {roleStep === "roles" ? (
                <div>
                  {/* Favorites section */}
                  {favFiltered.length > 0 && (
                    <div className="px-4 pt-4 pb-2">
                      <p className="text-xs font-bold text-amber-600 mb-2">⭐ บทบาทที่ใช้บ่อย</p>
                      {favFiltered.map((role) => {
                        const isSelected = selectedRoles.includes(role);
                        return (
                          <RoleListItem
                            key={role}
                            role={role}
                            isSelected={isSelected}
                            isFav
                            onToggle={() => toggleRole(role)}
                            onToggleFav={() => toggleFav(role)}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* All roles by group */}
                  {ALL_ROLES.map(({ group, roles }) => (
                    <div key={group} className="px-4 pt-3 pb-1">
                      <p className="text-xs font-bold text-gray-400 mb-2">{group}</p>
                      {roles.map((role) => {
                        const isSelected = selectedRoles.includes(role);
                        const isFav = favRoles.includes(role);
                        return (
                          <RoleListItem
                            key={role}
                            role={role}
                            isSelected={isSelected}
                            isFav={isFav}
                            onToggle={() => toggleRole(role)}
                            onToggleFav={() => toggleFav(role)}
                          />
                        );
                      })}
                    </div>
                  ))}
                  <div className="h-4" />
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-xs text-gray-500 mb-3">เลือกบทบาทที่จะเรียกระหว่างกลางคืนเพื่อไม่ให้ผู้เล่นรู้ว่าบทบาทจริงมีอะไร</p>
                  <div className="space-y-1">
                    {DECOY_ROLE_KEYS.map((key) => (
                      <button
                        key={key}
                        onClick={() => setSelectedDecoys((prev) =>
                          prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                        )}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold border transition-colors flex items-center gap-3 ${
                          selectedDecoys.includes(key)
                            ? "bg-orange/10 text-orange border-orange/30"
                            : "bg-gray-50 text-gray-600 border-gray-100"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-xs shrink-0 ${selectedDecoys.includes(key) ? "bg-orange text-white" : "bg-gray-200"}`}>
                          {selectedDecoys.includes(key) ? "✓" : ""}
                        </span>
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 shrink-0 space-y-2">
              {sessionError && <p className="text-red-500 text-xs text-center">{sessionError}</p>}
              {roleStep === "roles" ? (
                <button
                  onClick={() => setRoleStep("decoys")}
                  disabled={roleCount < playerCount}
                  className="w-full bg-navy text-cream py-3.5 rounded-2xl font-bold text-sm disabled:opacity-40"
                >
                  ถัดไป: เลือก Decoy Roles →
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setRoleStep("roles")} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold text-sm">← กลับ</button>
                  <button
                    onClick={startSession}
                    disabled={startingSession}
                    className="flex-[2] bg-orange text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                  >
                    {startingSession ? "กำลังสุ่ม..." : "🎲 สุ่มแจกไพ่ เริ่มเกม!"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL: DELETE ROOM CONFIRM
      ══════════════════════════════════════════════ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xs p-6 text-center">
            <p className="text-4xl mb-3">🗑️</p>
            <h3 className="font-bold text-navy text-lg mb-2">ลบห้อง {code}?</h3>
            <p className="text-sm text-gray-500 mb-6">จะลบผู้เล่น session และข้อมูลทั้งหมดในห้องนี้</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold text-sm">ยกเลิก</button>
              <button onClick={deleteRoom} disabled={deletingRoom} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50">
                {deletingRoom ? "กำลังลบ..." : "ลบเลย"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Role list item component ───────────────────────────────────────────
function RoleListItem({
  role, isSelected, isFav, onToggle, onToggleFav,
}: {
  role: string; isSelected: boolean; isFav: boolean;
  onToggle: () => void; onToggleFav: () => void;
}) {
  const short = role.split(" (")[0];
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 border cursor-pointer transition-colors ${isSelected ? "bg-navy text-cream border-navy" : "bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100"}`}>
      <button
        onClick={onToggle}
        className="flex-1 text-left text-sm font-bold flex items-center gap-2"
      >
        <span className={`w-5 h-5 rounded flex items-center justify-center text-xs shrink-0 ${isSelected ? "bg-white/20" : "bg-gray-200"}`}>
          {isSelected ? "✓" : ""}
        </span>
        {short}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
        className={`text-base shrink-0 ${isFav ? "text-amber-400" : "text-gray-300 hover:text-amber-300"}`}
      >
        ★
      </button>
    </div>
  );
}

// ── Page wrapper with Suspense ─────────────────────────────────────────
export default function GMRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
      <GMRoomInner code={code} />
    </Suspense>
  );
}
