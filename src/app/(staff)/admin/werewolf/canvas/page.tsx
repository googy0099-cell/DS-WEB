"use client";

import { useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CanvasInner() {
  const searchParams = useSearchParams();
  const roomCode = searchParams.get("room");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // On iframe load: fetch session → send LOAD_SESSION + SET_DECOY_ROLES
  const onIframeLoad = useCallback(async () => {
    if (!roomCode || !iframeRef.current?.contentWindow) return;
    try {
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
          role: sp.role,
        })
      );
      iframeRef.current.contentWindow.postMessage(
        { type: "LOAD_SESSION", roomCode, players: canvasPlayers },
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
    } catch {}
  }, [roomCode]);

  // Handle messages from canvas iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      // GAME_ENDED: canvas confirmed end directly — navigate to room
      if (e.data?.type === "GAME_ENDED" && roomCode) {
        setTimeout(() => {
          window.location.href = `/admin/werewolf/rooms/${roomCode}`;
        }, 1500);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [roomCode]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <a
        href={roomCode ? `/admin/werewolf/rooms/${roomCode}` : "/admin/werewolf"}
        className="absolute top-3 left-3 z-10 bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-black/80 transition-colors"
      >
        ← กลับ
      </a>

      {roomCode && (
        <div className="absolute top-3 right-3 z-10 bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg border border-white/20">
          🔗 ห้อง {roomCode}
        </div>
      )}

      <iframe
        ref={iframeRef}
        src="/werewolf-gm-canvas.html"
        className="w-full h-full border-0"
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
