"use client";

import { useEffect, useState, use, useCallback } from "react";
import useSWR from "swr";
import QRCode from "qrcode";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { wolfRoles, villagerRoles, indyRoles, vampireRoles, roleDescriptions } from "@/lib/werewolf-roles";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Player {
  id: number;
  seatName: string;
  seatOrder: number;
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
  seatOrder: number;
  role: string;
  team: string;
}

interface SessionData {
  id: number;
  phase: string;
  currentStep: string | null;
  nightNumber: number;
  dayNumber: number;
  winTeam: string | null;
  playerRoles: { userId: number; role: string; team: string; status: string; seatName: string | null; seatOrder?: number }[];
}

// ── Role data ──────────────────────────────────────────────────────────
const ALL_ROLES = [
  { group: "ฝ่ายหมาป่า", roles: wolfRoles },
  { group: "ฝ่ายชาวบ้าน", roles: villagerRoles },
  { group: "ฝ่ายอิสระ", roles: indyRoles },
  { group: "ฝ่ายแวมไพร์", roles: vampireRoles },
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
const TEAM_BG: Record<string, string> = {
  wolf: "bg-red-50", village: "bg-blue-50", indy: "bg-green-50", vampire: "bg-purple-50",
};
const TEAM_LABEL: Record<string, string> = {
  wolf: "หมาป่า", village: "ชาวบ้าน", indy: "อิสระ", vampire: "แวมไพร์",
};

// ── Seat row item (in seat manager) ───────────────────────────────────
interface SeatRow { userId: number; seatName: string; displayName: string; username: string }

function GMRoomInner({ code }: { code: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [qrUrl, setQrUrl] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  // Modals
  const [showSeatModal, setShowSeatModal]     = useState(false);
  const [showRoleModal, setShowRoleModal]     = useState(false);
  const [showCheckModal, setShowCheckModal]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Role selection
  const [roleCounts, setRoleCounts]         = useState<Record<string, number>>({});
  const [selectedDecoys, setSelectedDecoys] = useState<string[]>([]);
  const [roleStep, setRoleStep]             = useState<"roles" | "decoys">("roles");
  const [favRoles, setFavRoles]             = useState<string[]>([]);

  // Seat manager — ordered list of seats
  const [seatRows, setSeatRows]           = useState<SeatRow[]>([]);
  const [seatNames, setSeatNames]         = useState<Record<number, string>>({});
  const [memberSearch, setMemberSearch]   = useState("");
  const [memberResults, setMemberResults] = useState<MemberResult[]>([]);
  const [addingSeat, setAddingSeat]       = useState("");
  const [addingUserId, setAddingUserId]   = useState<number | null>(null);
  const [savingSeats, setSavingSeats]     = useState(false);

  // Session
  const [assignments, setAssignments]         = useState<Assignment[] | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  const [sessionError, setSessionError]       = useState("");
  const [deletingRoom, setDeletingRoom]       = useState(false);
  const [deleteError, setDeleteError]         = useState("");


  const { data: players, mutate: mutatePlayers } = useSWR<Player[]>(
    `/api/werewolf/rooms/${code}/players`,
    fetcher,
    { refreshInterval: 5000 }
  );

  // Poll session every 3s — used as Firebase fallback for game control panel
  const { data: dbSession } = useSWR<SessionData>(
    `/api/werewolf/sessions/${code}`,
    fetcher,
    { refreshInterval: 3000, onErrorRetry: () => {} }
  );

  // Load assignments + check modal from DB session
  useEffect(() => {
    if (!dbSession?.playerRoles?.length) return;
    const loaded: Assignment[] = dbSession.playerRoles.map((sp, i) => ({
      userId: sp.userId,
      seatName: sp.seatName ?? `User ${sp.userId}`,
      seatOrder: sp.seatOrder ?? i,
      role: sp.role,
      team: sp.team,
    }));
    setAssignments(loaded);
    if (searchParams.get("check") === "1") setShowCheckModal(true);
  }, [dbSession, searchParams]);

  // Load favorites
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

  // Sync seat rows when players change
  useEffect(() => {
    if (!Array.isArray(players)) return;
    const rows: SeatRow[] = players.map((p) => ({
      userId: p.user.id,
      seatName: p.seatName,
      displayName: p.user.nickname || p.user.firstName,
      username: p.user.username,
    }));
    setSeatRows(rows);
    const names: Record<number, string> = {};
    players.forEach((p) => { names[p.user.id] = p.seatName; });
    setSeatNames(names);
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

  // ── Seat reorder helpers ──────────────────────────────────────────────
  function moveSeat(index: number, dir: -1 | 1) {
    const next = [...seatRows];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setSeatRows(next);
  }

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
    const updates = seatRows.map((row, i) => ({
      userId: row.userId,
      seatName: (seatNames[row.userId] ?? row.seatName).trim() || row.displayName,
      seatOrder: i,
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
      setAddingUserId(null); setAddingSeat(""); setMemberSearch(""); setMemberResults([]);
    }
  }

  async function removePlayer(userId: number) {
    await fetch(`/api/werewolf/rooms/${code}/players`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    await mutatePlayers();
  }

  function toggleFav(role: string) {
    setFavRoles((prev) => {
      const next = prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function startSession() {
    setStartingSession(true);
    setSessionError("");
    const flatRoles = Object.entries(roleCounts).flatMap(([role, count]) => Array<string>(count).fill(role));
    try {
      const res = await fetch("/api/werewolf/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: code, selectedRoles: flatRoles, decoyRoles: selectedDecoys }),
      });
      const data = await res.json();
      if (!res.ok) { setSessionError(data.error || "เกิดข้อผิดพลาด"); return; }
      setAssignments(data.assignments.map((a: Assignment) => ({ ...a, seatOrder: a.seatOrder ?? 0 })));
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
    setDeleteError("");
    const res = await fetch(`/api/werewolf/rooms/${code}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/werewolf");
    } else {
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.error || `เกิดข้อผิดพลาด (${res.status})`);
      setDeletingRoom(false);
    }
  }

  const playerCount    = players?.length ?? 0;
  const hasSession     = !!assignments?.length;
  const totalSelected  = Object.values(roleCounts).reduce((s, c) => s + c, 0);
  const favFiltered    = favRoles.filter((r) =>
    [...wolfRoles, ...villagerRoles, ...indyRoles, ...vampireRoles].includes(r)
  );

  function incrementRole(role: string) {
    setRoleCounts((prev) => ({ ...prev, [role]: (prev[role] ?? 0) + 1 }));
  }
  function decrementRole(role: string) {
    setRoleCounts((prev) => {
      const cur = prev[role] ?? 0;
      if (cur <= 1) { const next = { ...prev }; delete next[role]; return next; }
      return { ...prev, [role]: cur - 1 };
    });
  }
  // Sorted assignments for check modal (by seatOrder)
  const sortedAssignments = assignments ? [...assignments].sort((a, b) => a.seatOrder - b.seatOrder) : [];

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

      {/* Player list + seat manager button */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-navy text-sm">ผู้เล่นในห้อง</h2>
          <div className="flex items-center gap-2">
            <span className="bg-navy text-cream text-xs font-bold px-2.5 py-0.5 rounded-full">
              {playerCount} คน
            </span>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/admin/werewolf/canvas?room=${code}&mode=seating`}
                className="text-xs bg-navy text-cream font-bold px-3 py-1 rounded-full"
              >
                🗺️ จัดที่นั่ง
              </Link>
              <button
                onClick={() => setShowSeatModal(true)}
                className="text-xs bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full hover:bg-gray-200"
              >
                ✏️ แก้ชื่อ
              </button>
            </div>
          </div>
        </div>

        {!players?.length ? (
          <p className="text-gray-400 text-sm text-center py-4">รอผู้เล่น scan QR...</p>
        ) : (
          <div className="space-y-2">
            {players.map((p, i) => {
              const assign = assignments?.find((a) => a.userId === p.user.id);
              return (
                <div key={p.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  {/* Seat number badge */}
                  <div className="w-7 h-7 rounded-full bg-navy text-cream flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-navy">{p.seatName}</p>
                    <p className="text-xs text-gray-400">{p.user.nickname || p.user.firstName}</p>
                  </div>
                  {assign && (
                    <div className={`text-right shrink-0 border px-2 py-0.5 rounded-lg ${TEAM_CHIP[assign.team]}`}>
                      <p className="text-xs font-bold leading-tight">{assign.role.split(" (")[0]}</p>
                      {assign.role.includes("(") && (
                        <p className="text-[10px] opacity-70 leading-tight">{assign.role.match(/\(([^)]+)\)/)?.[1]}</p>
                      )}
                    </div>
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
              <p className="text-xs text-green-600">ผู้เล่นที่ใช้มือถือดูบทบาทได้ทันที · ส่วนอื่นดูจาก GM View</p>
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
            <p className="text-cream/60 text-xs font-normal mt-0.5">token วางตามลำดับที่นั่ง · Night Phase · Mark ผู้เล่น</p>
          </Link>

          <button
            onClick={() => { setRoleStep("roles"); setSessionError(""); setShowRoleModal(true); }}
            className="w-full border border-gray-200 text-gray-500 font-bold py-3 rounded-xl text-sm"
          >
            🔄 เริ่มรอบใหม่ (สุ่มบทบาทใหม่)
          </button>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          <Link
            href={`/admin/werewolf/canvas?room=${code}&mode=seating`}
            className="block w-full bg-navy text-cream font-bold py-5 rounded-2xl text-base text-center shadow-lg"
          >
            🖥️ เปิด GM Canvas → จัดที่นั่ง + แจกไพ่ + เริ่มเกม
            <p className="text-cream/60 text-xs font-normal mt-0.5">จัดตำแหน่งจริง · เลือกบทบาท · ดำเนินเกม — ครบในหน้าเดียว</p>
          </Link>
          <button
            onClick={() => { setRoleStep("roles"); setSessionError(""); setShowRoleModal(true); }}
            disabled={!playerCount}
            className="w-full border border-gray-200 text-gray-500 font-bold py-3 rounded-xl text-sm disabled:opacity-40"
          >
            🎲 หรือสุ่มแจกแบบเร็ว (ไม่ใช้ Canvas)
          </button>
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
          MODAL: SEAT MANAGER (ORDERED SEATING)
      ══════════════════════════════════════════════ */}
      {showSeatModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-navy text-lg">🪑 จัดตำแหน่งที่นั่ง</h2>
                  <p className="text-xs text-gray-400 mt-0.5">ลำดับในรายการ = ตำแหน่งบนโต๊ะในแคนวาส (เริ่มจากบนตามเข็มนาฬิกา)</p>
                </div>
                <button onClick={() => setShowSeatModal(false)} className="text-gray-400 text-2xl leading-none">×</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {/* Ordered seat list with ↑↓ */}
              {seatRows.length > 0 ? (
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-2">ลำดับที่นั่ง — ลากหรือกด ↑↓ เพื่อเรียงใหม่</p>
                  <div className="space-y-2">
                    {seatRows.map((row, i) => (
                      <div key={row.userId} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                        {/* Seat number */}
                        <div className="w-7 h-7 rounded-full bg-navy text-cream flex items-center justify-center text-xs font-bold shrink-0">
                          {i + 1}
                        </div>
                        {/* Name input */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-400 mb-0.5">{row.displayName} (@{row.username})</p>
                          <input
                            type="text"
                            value={seatNames[row.userId] ?? row.seatName}
                            onChange={(e) => setSeatNames((prev) => ({ ...prev, [row.userId]: e.target.value }))}
                            className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm font-bold text-navy outline-none focus:border-navy"
                            placeholder="ชื่อ / เลขที่นั่ง"
                          />
                        </div>
                        {/* Up/Down */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            onClick={() => moveSeat(i, -1)}
                            disabled={i === 0}
                            className="w-7 h-7 flex items-center justify-center bg-gray-200 rounded text-xs disabled:opacity-30 hover:bg-gray-300"
                          >↑</button>
                          <button
                            onClick={() => moveSeat(i, 1)}
                            disabled={i === seatRows.length - 1}
                            className="w-7 h-7 flex items-center justify-center bg-gray-200 rounded text-xs disabled:opacity-30 hover:bg-gray-300"
                          >↓</button>
                        </div>
                        {/* Remove */}
                        <button
                          onClick={() => removePlayer(row.userId)}
                          className="shrink-0 text-red-400 hover:text-red-600 text-lg leading-none w-6"
                        >×</button>
                      </div>
                    ))}
                  </div>

                  {/* Visual seating on Canvas */}
                  <Link
                    href={`/admin/werewolf/canvas?room=${code}&mode=seating`}
                    className="mt-3 flex items-center gap-3 bg-navy text-cream rounded-xl p-3 active:opacity-80"
                    onClick={() => setShowSeatModal(false)}
                  >
                    <span className="text-xl shrink-0">🗺️</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-tight">จัดตำแหน่งบน Canvas</p>
                      <p className="text-xs text-cream/60 leading-tight mt-0.5">ลากผู้เล่นไปวางตำแหน่งที่นั่งจริงรอบโต๊ะ</p>
                    </div>
                    <span className="ml-auto text-cream/40 text-lg shrink-0">›</span>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-2">ยังไม่มีผู้เล่น — รอ scan QR หรือเพิ่มด้านล่าง</p>
              )}

              {/* Add card player by member search */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-bold text-gray-400 mb-2">เพิ่มผู้เล่นด้วยบัตรสมาชิก</p>
                <p className="text-[10px] text-gray-400 mb-2">สำหรับผู้เล่นที่ไม่ได้ scan QR — ยังเก็บคะแนนได้ โดย GM แจกการ์ดให้เอง</p>
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="ค้นหา username, รหัสสมาชิก, หรืออีเมล"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-navy mb-2"
                />
                {memberResults.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setAddingUserId(m.id); setMemberSearch(m.firstName); setMemberResults([]); }}
                    className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-navy/5 rounded-xl mb-1 text-sm"
                  >
                    <span className="font-bold text-navy">{m.firstName}</span>
                    <span className="text-gray-400 ml-2 text-xs">@{m.username} · {m.memberCode}</span>
                  </button>
                ))}
                {addingUserId && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={addingSeat}
                      onChange={(e) => setAddingSeat(e.target.value)}
                      placeholder="ชื่อที่นั่ง เช่น ที่นั่ง 3"
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
                {savingSeats ? "กำลังบันทึก..." : "✅ บันทึกตำแหน่งที่นั่ง"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODAL: ROLE CHECK — GM REFERENCE TABLE
      ══════════════════════════════════════════════ */}
      {showCheckModal && assignments && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[88vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-navy text-lg">🔍 ตรวจสอบบทบาท</h2>
                  <p className="text-xs text-gray-400 mt-0.5">GM View · ใช้แจกการ์ดให้ผู้เล่นที่ไม่มีมือถือ</p>
                </div>
                <button onClick={() => setShowCheckModal(false)} className="text-gray-400 text-2xl leading-none">×</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {sortedAssignments.map((a, i) => (
                <div key={a.userId} className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${TEAM_BG[a.team]} ${TEAM_CHIP[a.team].replace(/text-\S+/, "").replace(/bg-\S+/, "")}`}>
                  {/* Seat number */}
                  <div className="w-9 h-9 rounded-full bg-navy text-cream flex items-center justify-center font-bold text-sm shrink-0">
                    {i + 1}
                  </div>
                  {/* Seat name */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-navy">{a.seatName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${TEAM_CHIP[a.team]}`}>
                      {TEAM_LABEL[a.team]}
                    </span>
                  </div>
                  {/* Role */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm text-navy">{a.role.split(" (")[0]}</p>
                    {a.role.includes("(") && (
                      <p className="text-[10px] text-gray-500">{a.role.match(/\(([^)]+)\)/)?.[1]}</p>
                    )}
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
              <p className="text-xs text-center text-gray-400">
                📱 ผู้เล่นที่ join ผ่านมือถือจะเห็นบทบาทอัตโนมัติ · ที่เหลือ GM แจกการ์ดตามตาราง
              </p>
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
                      ? `เลือกแล้ว ${totalSelected} / ต้องการ ${playerCount} คน`
                      : "บทบาทที่จะเรียกหลอกระหว่างกลางคืน"
                    }
                  </p>
                </div>
                <button onClick={() => setShowRoleModal(false)} className="text-gray-400 text-2xl leading-none">×</button>
              </div>
              {roleStep === "roles" && totalSelected < playerCount && (
                <p className="text-xs text-red-400 mt-1">⚠ ต้องเลือกอย่างน้อย {playerCount} บทบาท (เลือกแล้ว {totalSelected})</p>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              {roleStep === "roles" ? (
                <div>
                  {favFiltered.length > 0 && (
                    <div className="px-4 pt-4 pb-2">
                      <p className="text-xs font-bold text-amber-600 mb-2">⭐ บทบาทที่ใช้บ่อย</p>
                      {favFiltered.map((role) => (
                        <RoleListItem
                          key={role}
                          role={role}
                          count={roleCounts[role] ?? 0}
                          isFav
                          onIncrement={() => incrementRole(role)}
                          onDecrement={() => decrementRole(role)}
                          onToggleFav={() => toggleFav(role)}
                        />
                      ))}
                    </div>
                  )}
                  {ALL_ROLES.map(({ group, roles }) => (
                    <div key={group} className="px-4 pt-3 pb-1">
                      <p className="text-xs font-bold text-gray-400 mb-2">{group}</p>
                      {roles.map((role) => (
                        <RoleListItem
                          key={role}
                          role={role}
                          count={roleCounts[role] ?? 0}
                          isFav={favRoles.includes(role)}
                          onIncrement={() => incrementRole(role)}
                          onDecrement={() => decrementRole(role)}
                          onToggleFav={() => toggleFav(role)}
                        />
                      ))}
                    </div>
                  ))}
                  <div className="h-4" />
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-xs text-gray-500 mb-3">บทบาทที่จะเรียกระหว่างกลางคืนเพื่อไม่ให้ผู้เล่นรู้ว่าบทบาทจริงมีอะไรบ้าง</p>
                  <div className="space-y-1">
                    {DECOY_ROLE_KEYS.map((key) => (
                      <button
                        key={key}
                        onClick={() => setSelectedDecoys((p) =>
                          p.includes(key) ? p.filter((k) => k !== key) : [...p, key]
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
                  disabled={totalSelected < playerCount}
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
            {deleteError && (
              <p className="text-red-500 text-xs text-center mb-3">{deleteError}</p>
            )}
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

// ── Role list item ─────────────────────────────────────────────────────
function RoleListItem({ role, count, isFav, onIncrement, onDecrement, onToggleFav }: {
  role: string; count: number; isFav: boolean;
  onIncrement: () => void; onDecrement: () => void; onToggleFav: () => void;
}) {
  const [showDesc, setShowDesc] = useState(false);
  const isSelected = count > 0;
  const thaiName   = role.split(" (")[0];
  const engName    = role.match(/\(([^)]+)\)/)?.[1] ?? "";
  const desc       = roleDescriptions[role];
  return (
    <div className={`rounded-xl mb-1 border transition-colors ${isSelected ? "bg-navy text-cream border-navy" : "bg-gray-50 text-gray-700 border-gray-100"}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Role name */}
        <button onClick={onIncrement} className="flex-1 text-left min-w-0">
          <span className="text-sm font-bold block leading-tight truncate">{thaiName}</span>
          {engName && <span className={`text-[10px] leading-tight ${isSelected ? "text-cream/60" : "text-gray-400"}`}>{engName}</span>}
        </button>

        {/* Info button */}
        {desc && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowDesc((v) => !v); }}
            className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${showDesc ? (isSelected ? "bg-white text-navy" : "bg-navy text-cream") : isSelected ? "bg-white/20 text-cream hover:bg-white/30" : "bg-gray-200 text-gray-500 hover:bg-gray-300"}`}
          >i</button>
        )}

        {/* Favorite star */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
          className={`text-base shrink-0 ${isFav ? "text-amber-400" : isSelected ? "text-white/30 hover:text-amber-300" : "text-gray-300 hover:text-amber-300"}`}
        >★</button>

        {/* Counter: − count + */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDecrement(); }}
            disabled={count === 0}
            className={`w-7 h-7 rounded-lg font-bold text-base flex items-center justify-center disabled:opacity-25 transition-colors ${isSelected ? "bg-white/20 hover:bg-white/30 text-cream" : "bg-gray-200 hover:bg-gray-300 text-gray-600"}`}
          >−</button>
          <span className={`w-6 text-center font-bold text-sm tabular-nums ${isSelected ? "text-cream" : "text-gray-300"}`}>
            {count > 0 ? count : ""}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onIncrement(); }}
            className={`w-7 h-7 rounded-lg font-bold text-base flex items-center justify-center transition-colors ${isSelected ? "bg-white/20 hover:bg-white/30 text-cream" : "bg-gray-200 hover:bg-gray-300 text-gray-600"}`}
          >+</button>
        </div>
      </div>

      {/* Description panel */}
      {showDesc && desc && (
        <div className={`px-3 pb-2.5 text-xs leading-relaxed ${isSelected ? "text-cream/80" : "text-gray-500"}`}>
          {desc}
        </div>
      )}
    </div>
  );
}

// ── Page with Suspense ─────────────────────────────────────────────────
export default function GMRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
      <GMRoomInner code={code} />
    </Suspense>
  );
}
