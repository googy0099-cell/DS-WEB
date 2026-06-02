"use client";
import { useEffect } from "react";

export default function WakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    async function acquire() {
      try { lock = await navigator.wakeLock.request("screen"); } catch {}
    }
    function onVisible() { if (document.visibilityState === "visible") acquire(); }
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);
  return null;
}
