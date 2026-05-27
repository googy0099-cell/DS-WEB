"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import QRCode from "qrcode";

type OrderItem = {
  id: number;
  quantity: number;
  unitPriceTHB: number;
  selectedSize: string | null;
  menuItem: { nameTh: string; category: string };
};
type Order = { id: number; status: string; totalTHB: number; createdAt: string; items: OrderItem[] };
type PlayerSession = {
  id: number;
  nickname: string;
  packageType: string;
  packagePrice: number;
  timeRemaining: number;
  status: string;
  totalSpent: number;
  orders: Order[];
  updatedAt: string;
};
type TableData = {
  id: number;
  number: number;
  isOccupied: boolean;
  playerSessions: PlayerSession[];
};

const PACKAGES: Record<string, { label: string; price: number; timeSeconds: number; desc: string }> = {
  A: { label: "Package A", price: 0, timeSeconds: 3600, desc: "สั่งเครื่องดื่ม — เล่นฟรี 1 ชม." },
  B: { label: "Package B", price: 49, timeSeconds: 7200, desc: "49฿ — เล่น 2 ชม." },
  C: { label: "Package C", price: 120, timeSeconds: 86400, desc: "120฿ — เหมาวัน + ฟรีเครื่องดื่ม" },
};

// ---- Timer Hook ----
function useTimer(timeRemaining: number, updatedAt: string) {
  const [secs, setSecs] = useState(() => {
    const elapsed = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000);
    return Math.max(0, timeRemaining - elapsed);
  });

  useEffect(() => {
    const interval = setInterval(() => setSecs((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(interval);
  }, []);

  return secs;
}

function fmt(secs: number) {
  if (secs >= 86400) return "∞";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timerColor(secs: number) {
  if (secs >= 86400) return { bar: "bg-purple-400", text: "text-purple-300", label: "∞" };
  if (secs > 600) return { bar: "bg-green-400", text: "text-green-400", label: "ปกติ" };
  if (secs > 0) return { bar: "bg-yellow-400", text: "text-yellow-400", label: "ใกล้หมด" };
  return { bar: "bg-red-500", text: "text-red-400", label: "หมดเวลา!" };
}

// ---- Session Card Component ----
function SessionCard({
  session,
  onCheckout,
  onAddTime,
}: {
  session: PlayerSession;
  onCheckout: (id: number) => void;
  onAddTime: (id: number, secs: number) => void;
}) {
  const remaining = useTimer(session.timeRemaining, session.updatedAt);
  const color = timerColor(remaining);
  const maxTime = PACKAGES[session.packageType]?.timeSeconds ?? 3600;
  const pct = remaining >= 86400 ? 100 : Math.min(100, (remaining / maxTime) * 100);
  const [showOrders, setShowOrders] = useState(false);

  return (
    <div className="bg-navy/80 rounded-2xl p-4 space-y-3 border border-white/10">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-white text-base">{session.nickname}</p>
          <p className="text-white/50 text-xs">{PACKAGES[session.packageType]?.desc}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${color.text} border border-current`}>
          {color.label}
        </span>
      </div>

      {/* Timer */}
      <div>
        <div className={`text-2xl font-mono font-bold ${color.text}`}>{fmt(remaining)}</div>
        <div className="mt-1.5 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${color.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Spend summary */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/60">ยอดสะสม</span>
        <span className="font-bold text-orange">฿{session.totalSpent}</span>
      </div>

      {/* Order summary toggle */}
      {session.orders.length > 0 && (
        <button
          onClick={() => setShowOrders(!showOrders)}
          className="text-xs text-white/40 hover:text-white/70 w-full text-left"
        >
          {showOrders ? "▲ ซ่อนออเดอร์" : `▼ ดูออเดอร์ (${session.orders.length} รายการ)`}
        </button>
      )}

      {showOrders && (
        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
          {session.orders.flatMap((o) =>
            o.items.map((item, i) => (
              <div key={`${o.id}-${i}`} className="flex justify-between text-xs text-white/60">
                <span>{item.menuItem.nameTh} {item.selectedSize ? `(${item.selectedSize})` : ""} ×{item.quantity}</span>
                <span>฿{item.unitPriceTHB * item.quantity}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onAddTime(session.id, 3600)}
          className="flex-1 text-xs bg-white/10 hover:bg-white/20 text-white font-semibold py-2 rounded-xl transition-colors"
        >
          +1 ชม.
        </button>
        <button
          onClick={() => onCheckout(session.id)}
          className="flex-1 text-xs bg-orange hover:bg-orange/80 text-white font-bold py-2 rounded-xl transition-colors"
        >
          ชำระเงิน
        </button>
      </div>
    </div>
  );
}

// ---- QR Modal ----
function QRModal({ tableNumber, onClose }: { tableNumber: number; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(2);
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined"
    ? `${window.location.origin}/table/${tableNumber}/${String(count).padStart(2, "0")}`
    : `/table/${tableNumber}/${String(count).padStart(2, "0")}`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 210, margin: 2 });
    }
  }, [url]);

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-navy text-lg text-center">QR โต๊ะ {tableNumber}</h3>

        {/* Count selector */}
        <div>
          <p className="text-xs font-semibold text-navy mb-2">จำนวนคน</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              className="w-9 h-9 bg-sand rounded-xl font-bold text-navy text-lg flex items-center justify-center"
            >−</button>
            <span className="flex-1 text-center font-bold text-navy text-xl">{count} คน</span>
            <button
              onClick={() => setCount((c) => Math.min(20, c + 1))}
              className="w-9 h-9 bg-sand rounded-xl font-bold text-navy text-lg flex items-center justify-center"
            >+</button>
          </div>
        </div>

        <canvas ref={canvasRef} className="mx-auto rounded-xl block" />
        <p className="text-[11px] text-gray-400 break-all text-center">{url}</p>

        <button onClick={copy} className="w-full bg-navy text-white font-semibold py-2.5 rounded-xl text-sm">
          {copied ? "✅ คัดลอกแล้ว!" : "📋 คัดลอกลิงก์"}
        </button>
        <button onClick={onClose} className="w-full border border-sand text-gray-500 font-semibold py-2.5 rounded-xl text-sm">
          ปิด
        </button>
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function AdminPosPage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [addPlayerModal, setAddPlayerModal] = useState<{ tableId: number } | null>(null);
  const [newNickname, setNewNickname] = useState("");
  const [newPackage, setNewPackage] = useState<"A" | "B" | "C">("A");
  const [saving, setSaving] = useState(false);
  const [qrTable, setQrTable] = useState<{ id: number; number: number } | null>(null);
  const [alert, setAlert] = useState<string | null>(null);

  const load = useCallback(async () => {
    const allTables = await fetch("/api/tables").then((r) => r.json()).catch(() => []);
    const withSessions = await Promise.all(
      (allTables as { id: number }[]).map((t) =>
        fetch(`/api/pos/table/${t.id}`).then((r) => r.json()).catch(() => null)
      )
    );
    setTables(withSessions.filter(Boolean));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Alert on any expired session
  useEffect(() => {
    const expired = tables.flatMap((t) =>
      t.playerSessions.filter((s) => {
        const elapsed = Math.floor((Date.now() - new Date(s.updatedAt).getTime()) / 1000);
        return s.timeRemaining - elapsed <= 0 && s.timeRemaining < 86400;
      })
    );
    if (expired.length > 0 && !alert) {
      setAlert(`⏰ หมดเวลา: ${expired.map((s) => s.nickname).join(", ")}`);
    }
  }, [tables, alert]);

  async function checkout(sessionId: number) {
    if (!confirm("ยืนยันชำระเงินและปิด Session?")) return;
    await fetch(`/api/pos/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    });
    load();
  }

  async function addTime(sessionId: number, seconds: number) {
    await fetch(`/api/pos/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addSeconds: seconds }),
    });
    load();
  }

  async function addPlayer() {
    if (!addPlayerModal || !newNickname.trim()) return;
    setSaving(true);
    await fetch("/api/pos/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: addPlayerModal.tableId, nickname: newNickname, packageType: newPackage }),
    });
    setAddPlayerModal(null);
    setNewNickname("");
    setNewPackage("A");
    setSaving(false);
    load();
  }

  const occupiedTables = tables.filter((t) => t.playerSessions.length > 0);
  const freeTables = tables.filter((t) => t.playerSessions.length === 0);

  return (
    <div className="space-y-6">
      {/* Alert banner */}
      {alert && (
        <div className="bg-red-500 text-white font-bold px-5 py-3 rounded-2xl flex items-center justify-between animate-pulse">
          <span>{alert}</span>
          <button onClick={() => setAlert(null)} className="text-white/80 hover:text-white text-lg">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-navy">POS — โต๊ะและผู้เล่น</h1>
        <div className="flex gap-2 text-xs">
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg font-semibold">● ปกติ &gt;10 นาที</span>
          <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg font-semibold">● ใกล้หมด ≤10 นาที</span>
          <span className="bg-red-100 text-red-600 px-2 py-1 rounded-lg font-semibold">● หมดเวลา</span>
        </div>
      </div>

      {loading && <p className="text-gray-400 py-8 text-center">กำลังโหลด...</p>}

      {/* Occupied tables */}
      {occupiedTables.map((table) => (
        <div key={table.id} className="bg-gradient-to-br from-navy to-indigo-900 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-bold text-lg">โต๊ะ {table.number}</h2>
              <p className="text-white/50 text-xs">{table.playerSessions.length} ผู้เล่น</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setQrTable({ id: table.id, number: table.number })}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
              >
                QR
              </button>
              <button
                onClick={() => setAddPlayerModal({ tableId: table.id })}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                + เพิ่มผู้เล่น
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {table.playerSessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                onCheckout={checkout}
                onAddTime={addTime}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Free tables */}
      {freeTables.length > 0 && (
        <div>
          <p className="text-gray-400 text-sm font-semibold mb-3">โต๊ะว่าง ({freeTables.length})</p>
          <div className="flex flex-wrap gap-3">
            {freeTables.map((t) => (
              <div key={t.id} className="flex gap-2">
                <button
                  onClick={() => setAddPlayerModal({ tableId: t.id })}
                  className="bg-white border-2 border-dashed border-gray-200 hover:border-orange text-gray-400 hover:text-orange font-semibold px-5 py-3 rounded-2xl text-sm transition-colors"
                >
                  + โต๊ะ {t.number}
                </button>
                <button
                  onClick={() => setQrTable({ id: t.id, number: t.number })}
                  className="bg-white border-2 border-gray-200 hover:border-orange text-gray-400 hover:text-orange font-semibold px-3 py-3 rounded-2xl text-sm transition-colors"
                >
                  QR
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrTable && (
        <QRModal tableNumber={qrTable.number} onClose={() => setQrTable(null)} />
      )}

      {/* Add Player Modal */}
      {addPlayerModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-bold text-navy text-lg">เพิ่มผู้เล่นใหม่</h3>

            <div>
              <label className="text-xs font-semibold text-navy block mb-1">ชื่อเล่น</label>
              <input
                autoFocus
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                placeholder="เช่น ปลา, มิ้ง, โต..."
                className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-navy block">แพ็กเกจ</label>
              {(["A", "B", "C"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setNewPackage(key)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm ${
                    newPackage === key
                      ? "border-orange bg-orange/5 text-navy"
                      : "border-sand text-gray-500 hover:border-orange/50"
                  }`}
                >
                  <span className="font-bold">{PACKAGES[key].label}</span>
                  <span className="text-xs ml-2 text-gray-400">{PACKAGES[key].desc}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAddPlayerModal(null)}
                className="flex-1 border border-sand text-navy font-semibold py-2.5 rounded-xl text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={addPlayer}
                disabled={saving || !newNickname.trim()}
                className="flex-1 bg-orange text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? "..." : "เพิ่มผู้เล่น"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
