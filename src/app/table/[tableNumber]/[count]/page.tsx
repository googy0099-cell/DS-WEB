"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const PACKAGES = [
  {
    key: "A",
    emoji: "🥤",
    label: "Package A",
    price: "ฟรี",
    time: "1 ชั่วโมง",
    desc: "สั่งเครื่องดื่ม Coffee / Milk&Tea / Soda Zaa 1 แก้ว",
  },
  {
    key: "B",
    emoji: "⏱️",
    label: "Package B",
    price: "49 บาท",
    time: "2 ชั่วโมง",
    desc: "เล่น 2 ชม. รวมค่าเข้า",
    highlight: true,
  },
  {
    key: "C",
    emoji: "🌟",
    label: "Package C",
    price: "120 บาท",
    time: "ไม่จำกัดเวลา",
    desc: "เหมาวัน — ฟรีเครื่องดื่ม 1 แก้ว",
  },
] as const;

export default function TableJoinPage() {
  const { tableNumber, count } = useParams<{ tableNumber: string; count: string }>();
  const router = useRouter();

  const [tableId, setTableId] = useState<number | null>(null);
  const [nickname, setNickname] = useState("");
  const [selected, setSelected] = useState<"A" | "B" | "C" | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const playerCount = parseInt(count, 10) || 1;

  useEffect(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then((tables: { id: number; number: number }[]) => {
        const found = tables.find((t) => t.number === parseInt(tableNumber, 10));
        if (!found) { setError("ไม่พบโต๊ะนี้ กรุณาขอลิงก์ใหม่จากพนักงาน"); setLoading(false); return; }
        setTableId(found.id);
        setLoading(false);
      })
      .catch(() => { setError("เกิดข้อผิดพลาด กรุณาลองใหม่"); setLoading(false); });
  }, [tableNumber]);

  async function confirm() {
    if (!selected || !nickname.trim() || !tableId) return;
    setSubmitting(true);
    const res = await fetch("/api/pos/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, nickname: nickname.trim(), packageType: selected }),
    });
    if (!res.ok) { setSubmitting(false); setError("เกิดข้อผิดพลาด กรุณาลองใหม่"); return; }
    const session = await res.json();
    sessionStorage.setItem("pos_sessionId", String(session.id));
    router.push(`/pos/${tableId}/menu`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy to-indigo-900 flex items-center justify-center">
        <p className="text-white/60">กำลังโหลด...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy to-indigo-900 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-4xl mb-4">😕</p>
          <p className="text-white font-bold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy to-indigo-900 flex flex-col items-center justify-center px-4 py-10">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-orange flex items-center justify-center mx-auto mb-3 shadow-lg">
          <span className="text-2xl">🎲</span>
        </div>
        <h1 className="text-white font-bold text-xl">DICE SHOP</h1>
        <div className="flex items-center justify-center gap-3 mt-1">
          <span className="bg-white/10 text-white/80 text-sm px-3 py-1 rounded-full">โต๊ะ {tableNumber}</span>
          <span className="bg-white/10 text-white/80 text-sm px-3 py-1 rounded-full">{playerCount} คน</span>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Nickname */}
        <div className="bg-white rounded-2xl p-4 shadow-xl">
          <label className="text-xs font-bold text-navy block mb-2">ชื่อเล่นของคุณ</label>
          <input
            autoFocus
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && selected && confirm()}
            placeholder="เช่น ปลา, มิ้ง, ต้น..."
            className="w-full border-2 border-sand rounded-xl px-4 py-3 text-base focus:border-orange focus:outline-none"
          />
        </div>

        {/* Package */}
        <div className="space-y-2">
          <p className="text-white/70 text-xs font-semibold px-1">เลือกแพ็กเกจ</p>
          {PACKAGES.map((pkg) => (
            <button
              key={pkg.key}
              onClick={() => setSelected(pkg.key)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                selected === pkg.key
                  ? "border-orange bg-orange/10 scale-[1.01]"
                  : "highlight" in pkg && pkg.highlight
                    ? "border-white/30 bg-white/10"
                    : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-white font-bold text-sm">{pkg.emoji} {pkg.label}</span>
                <span className={`text-sm font-bold ${selected === pkg.key ? "text-orange" : "text-white"}`}>
                  {pkg.price}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-white/10 text-white/60 text-xs px-2 py-0.5 rounded-full">⏳ {pkg.time}</span>
                {"highlight" in pkg && pkg.highlight && (
                  <span className="bg-orange/30 text-orange text-xs px-2 py-0.5 rounded-full font-semibold">แนะนำ</span>
                )}
              </div>
              <p className="text-white/40 text-xs mt-1">{pkg.desc}</p>
            </button>
          ))}
        </div>

        <p className="text-white/30 text-xs text-center">
          💡 สั่งเครื่องดื่ม Coffee / Milk&Tea / Soda = +1 ชม. ทุกแก้ว
        </p>

        <button
          onClick={confirm}
          disabled={!selected || !nickname.trim() || submitting}
          className="w-full bg-orange text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 hover:bg-orange/90 transition-colors"
        >
          {submitting ? "กำลังเข้าร่วม..." : "เข้าร่วมโต๊ะ →"}
        </button>
      </div>
    </div>
  );
}
