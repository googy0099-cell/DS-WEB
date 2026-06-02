"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OrderWithItems } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function playBeep(ctx: AudioContext) {
  const now = ctx.currentTime;
  const pattern = [0, 0.15, 0.3, 0.45];
  pattern.forEach((t) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(1050, now + t);
    osc.frequency.setValueAtTime(780, now + t + 0.06);
    gain.gain.setValueAtTime(0.6, now + t);
    gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.12);
    osc.start(now + t);
    osc.stop(now + t + 0.12);
  });
}

function playDoneChime(ctx: AudioContext) {
  const notes = [880, 1108];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.5);
  });
}

// Wrapper: skip on /admin dashboard (OrderQueue handles alerts there)
export default function GlobalOrderAlert() {
  const pathname = usePathname();
  if (pathname === "/admin") return null;
  return <GlobalOrderAlertInner />;
}

function GlobalOrderAlertInner() {
  const { data: orders } = useSWR<OrderWithItems[]>(
    "/api/orders?status=active",
    fetcher,
    { refreshInterval: 2000 }
  );

  const audioCtxRef = useRef<AudioContext | null>(null);
  const alertBufRef = useRef<ArrayBuffer | null>(null);
  const kitchenBufRef = useRef<ArrayBuffer | null>(null);
  const alertLoopRef = useRef<AudioBufferSourceNode | null>(null);
  const kitchenLoopRef = useRef<AudioBufferSourceNode | null>(null);
  const prevIdsRef = useRef<Set<number>>(new Set());
  const prevKitchenDoneRef = useRef<Set<number>>(new Set());
  const firstRenderRef = useRef(true);

  const [alertEnabled, setAlertEnabled] = useState(true);
  const [alertSoundUrl, setAlertSoundUrl] = useState("");
  const [kitchenSoundUrl, setKitchenSoundUrl] = useState("");

  const [alertOrderAcked, setAlertOrderAcked] = useState<Set<number>>(() => {
    try {
      if (typeof window === "undefined") return new Set<number>();
      return new Set(JSON.parse(localStorage.getItem("alertOrderAcked") ?? "[]") as number[]);
    } catch { return new Set<number>(); }
  });
  const [kitchenItemAcked] = useState<Set<number>>(() => {
    try {
      if (typeof window === "undefined") return new Set<number>();
      return new Set(JSON.parse(localStorage.getItem("kitchenItemAcked") ?? "[]") as number[]);
    } catch { return new Set<number>(); }
  });

  // Load custom sounds from site settings
  useEffect(() => {
    fetch("/api/site-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.alert_sound_url) setAlertSoundUrl(data.alert_sound_url);
        if (data.kitchen_sound_url) setKitchenSoundUrl(data.kitchen_sound_url);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!alertSoundUrl) { alertBufRef.current = null; return; }
    fetch(alertSoundUrl).then((r) => r.arrayBuffer()).then((buf) => { alertBufRef.current = buf; }).catch(() => {});
  }, [alertSoundUrl]);

  useEffect(() => {
    if (!kitchenSoundUrl) { kitchenBufRef.current = null; return; }
    fetch(kitchenSoundUrl).then((r) => r.arrayBuffer()).then((buf) => { kitchenBufRef.current = buf; }).catch(() => {});
  }, [kitchenSoundUrl]);

  async function playCustom(bufRef: React.MutableRefObject<ArrayBuffer | null>) {
    if (!bufRef.current) return false;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      const decoded = await ctx.decodeAudioData(bufRef.current.slice(0));
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      src.start();
      return true;
    } catch { return false; }
  }

  function ackAlertOrders(ids: number[]) {
    setAlertOrderAcked((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      try { localStorage.setItem("alertOrderAcked", JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // Alert orders (same logic as OrderQueue)
  const alertOrders = (orders ?? []).filter((o) => {
    if (o.handledById) return false;
    const m = o.payment?.method;
    if (o.status === "PENDING") return m === "CASH" || m === "PROMPTPAY" || m === "TAB";
    if (o.status === "CONFIRMED") return !m || m === "UNSET" || m === "CASH" || m === "PROMPTPAY" || (m === "TAB" && !!o.billId);
    return false;
  });

  const unackedAlertOrders = alertOrders.filter((o) => !alertOrderAcked.has(o.id));

  const kitchenReadyItems = (orders ?? []).flatMap((o) =>
    o.status === "SERVED" || o.status === "CANCELLED"
      ? []
      : o.items.filter((i) => i.kitchenServedAt && !kitchenItemAcked.has(i.id))
  );

  // Clean up stale acks
  useEffect(() => {
    if (!orders) return;
    const activeAlertIds = new Set(alertOrders.map((o) => o.id));
    setAlertOrderAcked((prev) => {
      const next = new Set([...prev].filter((id) => activeAlertIds.has(id)));
      if (next.size !== prev.size) {
        try { localStorage.setItem("alertOrderAcked", JSON.stringify([...next])); } catch {}
        return next;
      }
      return prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  // Fire sounds on new orders / kitchen done
  useEffect(() => {
    if (!orders) return;
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      prevIdsRef.current = new Set(orders.map((o) => o.id));
      prevKitchenDoneRef.current = new Set(
        orders.filter((o) => o.items.length > 0 && o.items.every((i) => !!i.kitchenServedAt)).map((o) => o.id)
      );
      return;
    }
    if (!alertEnabled) return;

    const newOrders = orders.filter((o) => {
      if (prevIdsRef.current.has(o.id)) return false;
      if (o.handledById) return false;
      const m = o.payment?.method;
      if (o.status === "CONFIRMED" || o.status === "PAID") return true;
      return o.status === "PENDING" && (m === "CASH" || m === "PROMPTPAY" || m === "TAB");
    });

    const newKitchenDone = orders.filter(
      (o) => o.items.length > 0 && o.items.every((i) => !!i.kitchenServedAt) && !prevKitchenDoneRef.current.has(o.id)
    );

    void (async () => {
      if (newOrders.length > 0) {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        const ctx = audioCtxRef.current;
        try { if (ctx.state === "suspended") await ctx.resume(); } catch {}
        const played = await playCustom(alertBufRef);
        if (!played) playBeep(ctx);
      }
      if (newKitchenDone.length > 0) {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        const ctx = audioCtxRef.current;
        try { if (ctx.state === "suspended") await ctx.resume(); } catch {}
        const played = await playCustom(kitchenBufRef);
        if (!played) playDoneChime(ctx);
      }
    })();

    prevIdsRef.current = new Set(orders.map((o) => o.id));
    prevKitchenDoneRef.current = new Set(
      orders.filter((o) => o.items.length > 0 && o.items.every((i) => !!i.kitchenServedAt)).map((o) => o.id)
    );
  }, [orders, alertEnabled]);

  // Loop alert sound while unacked
  useEffect(() => {
    const hasAlerts = alertEnabled && unackedAlertOrders.length > 0;

    if (alertLoopRef.current) {
      try { alertLoopRef.current.stop(); } catch {}
      alertLoopRef.current = null;
    }
    if (!hasAlerts) return;

    let cancelled = false;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    async function startLoop() {
      if (alertBufRef.current) {
        try {
          if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
          const ctx = audioCtxRef.current;
          if (ctx.state === "suspended") await ctx.resume();
          if (cancelled) return;
          const decoded = await ctx.decodeAudioData(alertBufRef.current.slice(0));
          if (cancelled) return;
          const src = ctx.createBufferSource();
          src.buffer = decoded;
          src.loop = true;
          src.connect(ctx.destination);
          src.start();
          if (cancelled) { try { src.stop(); } catch {} return; }
          alertLoopRef.current = src;
          return;
        } catch {}
      }
      if (!cancelled) {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        const ctx = audioCtxRef.current;
        try { if (ctx.state === "suspended") await ctx.resume(); } catch {}
        playBeep(ctx);
        fallbackInterval = setInterval(() => { if (!cancelled) playBeep(ctx); }, 2500);
      }
    }

    void startLoop();
    return () => {
      cancelled = true;
      if (alertLoopRef.current) { try { alertLoopRef.current.stop(); } catch {} alertLoopRef.current = null; }
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertEnabled, unackedAlertOrders.length > 0, alertSoundUrl]);

  // Loop kitchen chime while unserved kitchen-done items
  useEffect(() => {
    const hasReady = alertEnabled && kitchenReadyItems.length > 0;

    if (kitchenLoopRef.current) { try { kitchenLoopRef.current.stop(); } catch {} kitchenLoopRef.current = null; }
    if (!hasReady) return;

    let cancelled = false;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    async function startLoop() {
      if (kitchenBufRef.current) {
        try {
          if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
          const ctx = audioCtxRef.current;
          if (ctx.state === "suspended") await ctx.resume();
          if (cancelled) return;
          const decoded = await ctx.decodeAudioData(kitchenBufRef.current.slice(0));
          if (cancelled) return;
          const src = ctx.createBufferSource();
          src.buffer = decoded;
          src.loop = true;
          src.connect(ctx.destination);
          src.start();
          if (cancelled) { try { src.stop(); } catch {} return; }
          kitchenLoopRef.current = src;
          return;
        } catch {}
      }
      if (!cancelled) {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        const ctx = audioCtxRef.current;
        try { if (ctx.state === "suspended") await ctx.resume(); } catch {}
        playDoneChime(ctx);
        fallbackInterval = setInterval(() => { if (!cancelled) playDoneChime(ctx); }, 2500);
      }
    }

    void startLoop();
    return () => {
      cancelled = true;
      if (kitchenLoopRef.current) { try { kitchenLoopRef.current.stop(); } catch {} kitchenLoopRef.current = null; }
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertEnabled, kitchenReadyItems.length > 0, kitchenSoundUrl]);

  const hasUnacked = unackedAlertOrders.length > 0;
  const hasKitchenReady = kitchenReadyItems.length > 0;

  if (!hasUnacked && !hasKitchenReady) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 md:bottom-6 md:right-20 flex flex-col gap-2 items-end">
      {hasUnacked && (
        <div className="flex items-center gap-2 bg-navy border border-orange/30 rounded-2xl shadow-xl px-3 py-2">
          <span className="relative flex items-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-orange opacity-50 animate-ping" />
            <span className="text-orange text-lg">🔔</span>
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-cream text-xs font-bold">{unackedAlertOrders.length} ออเดอร์ใหม่</span>
            <Link href="/admin" className="text-orange text-[10px] underline underline-offset-2">ไปแดชบอร์ด →</Link>
          </div>
          <button
            onClick={() => { setAlertEnabled(false); ackAlertOrders(alertOrders.map((o) => o.id)); }}
            className="ml-1 text-cream/40 hover:text-cream text-lg leading-none"
            aria-label="ปิดเสียง"
          >
            ×
          </button>
        </div>
      )}
      {hasKitchenReady && (
        <div className="flex items-center gap-2 bg-green-800 border border-green-400/30 rounded-2xl shadow-xl px-3 py-2">
          <span className="text-green-300 text-lg">✅</span>
          <div className="flex flex-col leading-tight">
            <span className="text-white text-xs font-bold">อาหารพร้อมเสิร์ฟ</span>
            <Link href="/admin" className="text-green-300 text-[10px] underline underline-offset-2">ดูที่แดชบอร์ด →</Link>
          </div>
        </div>
      )}
      {!alertEnabled && (
        <button
          onClick={() => setAlertEnabled(true)}
          className="text-xs text-cream/50 bg-navy/80 border border-cream/10 rounded-xl px-3 py-1.5 hover:text-cream"
        >
          🔕 เปิดเสียงอีกครั้ง
        </button>
      )}
    </div>
  );
}
