"use client";

import { useEffect, useState, use } from "react";
import useSWR from "swr";
import QRCode from "qrcode";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { wolfRoles, villagerRoles, indyRoles, vampireRoles } from "@/lib/werewolf-roles";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Player {
  id: number;
  seatName: string;
  joinedAt: string;
  user: { id: number; firstName: string; nickname: string | null; username: string };
}

interface Assignment {
  userId: number;
  seatName: string;
  name: string;
  role: string;
  team: string;
}

interface SessionData {
  id: number;
  phase: string;
  playerRoles: { userId: number; role: string; team: string; seatName: string | null }[];
}

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

const TEAM_CHIP: Record<string, string> = {
  wolf: "bg-red-100 text-red-700 border-red-200",
  village: "bg-blue-100 text-blue-700 border-blue-200",
  indy: "bg-green-100 text-green-700 border-green-200",
  vampire: "bg-purple-100 text-purple-700 border-purple-200",
};

const TEAM_LABEL: Record<string, string> = {
  wolf: "หมาป่า", village: "ชาวบ้าน", indy: "อิสระ", vampire: "แวมไพร์",
};

function GMRoomInner({ code }: { code: string }) {
  const searchParams = useSearchParams();
  const [qrUrl, setQrUrl] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  // Role selection modal steps
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedDecoys, setSelectedDecoys] = useState<string[]>([]);
  const [roleStep, setRoleStep] = useState<"roles" | "decoys">("roles");

  // Role check modal (after session created)
  const [showCheckModal, setShowCheckModal] = useState(false);

  // Session state
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  const [sessionError, setSessionError] = useState("");

  const { data: players, isLoading } = useSWR<Player[]>(
    `/api/werewolf/rooms/${code}/players`,
    fetcher,
    { refreshInterval: 5000 }
  );

  // Load existing session on mount; auto-open check modal if ?check=1
  useEffect(() => {
    fetch(`/api/werewolf/sessions/${code}`)
      .then((r) => r.json())
      .then((s: SessionData) => {
        if (s?.playerRoles?.length) {
          const loaded = s.playerRoles.map((sp) => ({
            userId: sp.userId,
            seatName: sp.seatName ?? `User ${sp.userId}`,
            name: sp.seatName ?? `User ${sp.userId}`,
            role: sp.role,
            team: sp.team,
          }));
          setAssignments(loaded);
          if (searchParams.get("check") === "1") setShowCheckModal(true);
        }
      })
      .catch(() => {});
  }, [code, searchParams]);

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

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function toggleDecoy(key: string) {
    setSelectedDecoys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function startSession() {
    setStartingSession(true);
    setSessionError("");
    try {
      const res = await fetch("/api/werewolf/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: code, selectedRoles, decoyRoles: selectedDecoys }),
      });
      const data = await res.json();
      if (!res.ok) { setSessionError(data.error || "เกิดข้อผิดพลาด"); return; }
      setAssignments(data.assignments);
      setShowRoleModal(false);
      setShowCheckModal(true); // auto-open role check after shuffle
    } catch {
      setSessionError("เกิดข้อผิดพลาด");
    } finally {
      setStartingSession(false);
    }
  }

  const playerCount = players?.length ?? 0;
  const roleCount = selectedRoles.length;
  const hasSession = !!assignments?.length;

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
        <p className="text-xs text-gray-400">ให้ผู้เล่น scan QR หรือไปที่ /join/{code}</p>
      </div>

      {/* Player list */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-navy text-sm">ผู้เล่นในห้อง</h2>
          <span className="bg-navy text-cream text-xs font-bold px-2.5 py-0.5 rounded-full">
            {playerCount} คน
          </span>
        </div>
        {isLoading ? (
          <p className="text-gray-400 text-sm text-center py-3">กำลังโหลด...</p>
        ) : !players?.length ? (
          <p className="text-gray-400 text-sm text-center py-4">รอผู้เล่น scan QR...</p>
        ) : (
          <div className="space-y-2">
            {players.map((p) => {
              const assign = assignments?.find((a) => a.userId === p.user.id);
              return (
                <div key={p.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center text-navy font-bold text-sm shrink-0">
                    {p.seatName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-navy">{p.seatName}</p>
                    <p className="text-xs text-gray-400">{p.user.nickname || p.user.firstName}</p>
                  </div>
                  {assign && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${TEAM_CHIP[assign.team]}`}>
                      {assign.role.split(" (")[0]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* === SESSION ACTIVE: show role check + canvas buttons === */}
      {hasSession ? (
        <div className="space-y-3 mb-4">
          {/* Status */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-bold text-green-800 text-sm">แจกไพ่แล้ว — {assignments!.length} คน</p>
              <p className="text-xs text-green-600">ผู้เล่นสามารถดูบทบาทในมือถือได้แล้ว</p>
            </div>
          </div>

          {/* Role check button (PROMINENT) */}
          <button
            onClick={() => setShowCheckModal(true)}
            className="w-full bg-white border-2 border-navy text-navy font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 active:bg-navy/5"
          >
            🔍 ตรวจสอบบทบาท (GM View)
          </button>

          {/* Open GM Canvas (MOST PROMINENT) */}
          <Link
            href={`/admin/werewolf/canvas?room=${code}`}
            className="block w-full bg-navy text-cream font-bold py-5 rounded-2xl text-base text-center shadow-lg"
          >
            🖥️ เปิด GM Canvas
            <p className="text-cream/60 text-xs font-normal mt-0.5">ดำเนินเกม · ติดตาม Night Phase</p>
          </Link>

          {/* Reset round */}
          <button
            onClick={() => { setRoleStep("roles"); setShowRoleModal(true); }}
            className="w-full border border-gray-200 text-gray-500 font-bold py-3 rounded-xl text-sm"
          >
            🔄 เริ่มรอบใหม่ (สุ่มบทบาทใหม่)
          </button>
        </div>
      ) : (
        /* === NO SESSION: show start button === */
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
            🖥️ เปิด GM Canvas (ไม่มี session)
          </Link>
        </div>
      )}

      {/* Room controls */}
      <button
        onClick={toggleRoom}
        className={`w-full py-3 rounded-xl font-bold text-sm border ${isOpen ? "border-red-200 text-red-600 bg-red-50" : "border-green-200 text-green-700 bg-green-50"}`}
      >
        {isOpen ? "🔒 ปิดห้อง (ไม่รับผู้เล่นใหม่)" : "🔓 เปิดห้อง"}
      </button>

      {/* ── ROLE CHECK MODAL ── */}
      {showCheckModal && assignments && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[88vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-navy text-lg">🔍 ตรวจสอบบทบาท</h2>
                  <p className="text-xs text-gray-400 mt-0.5">GM View — ผู้เล่นไม่เห็นหน้าจอนี้</p>
                </div>
                <button onClick={() => setShowCheckModal(false)} className="text-gray-400 text-2xl leading-none">×</button>
              </div>
            </div>

            {/* Role list */}
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {assignments.map((a) => (
                <div key={a.userId} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center text-navy font-bold shrink-0">
                    {a.seatName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-navy">{a.seatName}</p>
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

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 shrink-0 space-y-2">
              <p className="text-xs text-center text-gray-400">
                💡 แจ้งผู้เล่นให้ดูบทบาทที่มุมขวาบนของมือถือ
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

      {/* ── ROLE SELECTION MODAL ── */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[88vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 shrink-0">
              <div className="flex justify-between items-center mb-1">
                <div>
                  <h2 className="font-bold text-navy text-lg">
                    {roleStep === "roles" ? "① เลือกบทบาทในเกม" : "② เลือก Decoy Roles"}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {roleStep === "roles"
                      ? `เลือกแล้ว ${roleCount} / ต้องการ ${playerCount} คน`
                      : "บทบาทที่จะเรียกหลอกระหว่างกลางคืน (ไม่ได้เล่นจริง)"
                    }
                  </p>
                </div>
                <button onClick={() => setShowRoleModal(false)} className="text-gray-400 text-2xl leading-none">×</button>
              </div>
              {roleStep === "roles" && roleCount < playerCount && (
                <p className="text-xs text-red-400 mt-1">⚠ ต้องเลือกอย่างน้อย {playerCount} บทบาท</p>
              )}
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {roleStep === "roles" ? (
                <div className="space-y-4">
                  {ALL_ROLES.map(({ group, roles }) => (
                    <div key={group}>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-2">{group}</p>
                      <div className="flex flex-wrap gap-2">
                        {roles.map((role) => {
                          const isSelected = selectedRoles.includes(role);
                          return (
                            <button
                              key={role}
                              onClick={() => toggleRole(role)}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                                isSelected ? "bg-navy text-cream border-navy" : "bg-gray-50 text-gray-600 border-gray-200"
                              }`}
                            >
                              {role.split(" (")[0]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 mb-3">เลือกบทบาทที่ต้องการเรียกระหว่างกลางคืน เพื่อไม่ให้ผู้เล่นรู้ว่าบทบาทจริงมีอะไรบ้าง</p>
                  <div className="flex flex-wrap gap-2">
                    {DECOY_ROLE_KEYS.map((key) => (
                      <button
                        key={key}
                        onClick={() => toggleDecoy(key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                          selectedDecoys.includes(key)
                            ? "bg-orange text-white border-orange"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}
                      >
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
                  <button
                    onClick={() => setRoleStep("roles")}
                    className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold text-sm"
                  >
                    ← กลับ
                  </button>
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
    </div>
  );
}

export default function GMRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">กำลังโหลด...</div>}>
      <GMRoomInner code={code} />
    </Suspense>
  );
}
