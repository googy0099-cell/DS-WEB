"use client";

import { useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CanvasInner() {
  const searchParams = useSearchParams();
  const roomCode = searchParams.get("room");
  const mode = searchParams.get("mode"); // "seating" or null
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // On iframe load: fetch session → send LOAD_SESSION + SET_DECOY_ROLES
  const onIframeLoad = useCallback(async () => {
    if (!roomCode || !iframeRef.current?.contentWindow) return;
    // Always connect the canvas to the room: live player sync + game control + role dealing
    iframeRef.current.contentWindow.postMessage({
      type: "INIT_LIVE",
      roomCode,
      fbUrl: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "https://diceshopadmin-default-rtdb.asia-southeast1.firebasedatabase.app",
    }, "*");
    try {
      if (mode === "seating") {
        // Seating mode: load players (session may not exist yet)
        let players: { seatName: string; role: string }[] = [];

        // Try session first
        const sessionRes = await fetch(`/api/werewolf/sessions/${roomCode}`);
        if (sessionRes.ok) {
          const s = await sessionRes.json();
          players = (s.playerRoles ?? []).map(
            (sp: { seatName: string | null; userId: number; role: string }) => ({
              seatName: sp.seatName ?? `User ${sp.userId}`,
              role: sp.role ?? "",
            })
          );
        }

        // Fall back to room players (before session created)
        if (!players.length) {
          const roomRes = await fetch(`/api/werewolf/rooms/${roomCode}/players`);
          if (roomRes.ok) {
            const rps = await roomRes.json();
            players = (rps ?? []).map(
              (p: { seatName?: string; user?: { firstName?: string }; id?: number }) => ({
                seatName: p.seatName ?? p.user?.firstName ?? `Player ${p.id ?? "?"}`,
                role: "",
              })
            );
          }
        }

        iframeRef.current.contentWindow.postMessage(
          { type: "SEATING_MODE", roomCode, players },
          "*"
        );
      } else {
        // Normal game mode
        const res = await fetch(`/api/werewolf/sessions/${roomCode}`);
        if (!res.ok) return;
        const s = await res.json();

        // Decoy roles for startNight()
        const decoyRoles: string[] = JSON.parse(s.decoyRoles || "[]");
        iframeRef.current.contentWindow.postMessage({ type: "SET_DECOY_ROLES", decoyRoles }, "*");

        // Player assignments → canvas loads names + roles automatically
        const canvasPlayers = (s.playerRoles ?? []).map(
          (sp: { seatName: string | null; userId: number; role: string }) => ({
            seatName: sp.seatName ?? `User ${sp.userId}`,
            userId: sp.userId,
            role: sp.role,
          })
        );
        iframeRef.current.contentWindow.postMessage(
          { type: "LOAD_SESSION", roomCode, players: canvasPlayers, phase: s.phase },
          "*"
        );

        // Advance phase to PLAYING so player phones leave SETUP screen immediately
        if (s.phase === "SETUP") {
          fetch(`/api/werewolf/sessions/${roomCode}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phase: "PLAYING" }),
          }).catch(() => {});
        }
      }
    } catch {}
  }, [roomCode, mode]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-gray-950 border-b border-gray-800">
        <a
          href={roomCode ? `/admin/werewolf/rooms/${roomCode}` : "/admin/werewolf"}
          className="bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg border border-gray-600 active:bg-gray-700"
        >
          ← กลับ
        </a>
        {roomCode && (
          <span className="text-gray-400 text-xs">🔗 ห้อง {roomCode}</span>
        )}
      </div>
      <iframe
        ref={iframeRef}
        src="/werewolf-gm-canvas.html"
        className="flex-1 w-full border-0"
        allow="autoplay"
        title="Werewolf GM Canvas"
        onLoad={onIframeLoad}
      />
    </div>
  );
}

export default function WerewolfCanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-black flex items-center justify-center">
          <p className="text-gray-400 text-sm">กำลังโหลด...</p>
        </div>
      }
    >
      <CanvasInner />
    </Suspense>
  );
}
