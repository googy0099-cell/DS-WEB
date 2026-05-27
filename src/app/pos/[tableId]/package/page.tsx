"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

const PACKAGES = [
  {
    key: "A",
    emoji: "🥤",
    label: "Package A",
    price: "ฟรี",
    time: "1 ชั่วโมง",
    desc: "สั่งเครื่องดื่มจากเมนู Coffee / Milk&Tea / Soda Zaa 1 แก้ว",
    highlight: false,
  },
  {
    key: "B",
    emoji: "⏱️",
    label: "Package B",
    price: "49 บาท",
    time: "2 ชั่วโมง",
    desc: "เล่น 1 ชม. ฟรี + ฟรีอีก 1 ชม. รวม 2 ชม.",
    highlight: true,
  },
  {
    key: "C",
    emoji: "🌟",
    label: "Package C",
    price: "120 บาท",
    time: "ไม่จำกัดเวลา",
    desc: "เหมาวัน — ฟรีเครื่องดื่ม 1 แก้ว",
    highlight: false,
  },
] as const;

export default function PackagePage() {
  const { tableId } = useParams<{ tableId: string }>();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [selected, setSelected] = useState<"A" | "B" | "C" | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const name = sessionStorage.getItem("pos_nickname");
    if (!name) { router.replace(`/pos/${tableId}`); return; }
    setNickname(name);
  }, [tableId, router]);

  async function confirm() {
    if (!selected) return;
    setLoading(true);
    const res = await fetch("/api/pos/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId: Number(tableId), nickname, packageType: selected }),
    });
    if (!res.ok) { setLoading(false); return; }
    const session = await res.json();
    sessionStorage.setItem("pos_sessionId", String(session.id));
    sessionStorage.removeItem("pos_nickname");
    router.push(`/pos/${tableId}/menu`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy to-indigo-900 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-orange flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🎲</span>
        </div>
        <p className="text-white font-bold text-lg">สวัสดี, {nickname}!</p>
        <p className="text-white/50 text-sm">เลือกแพ็กเกจที่ต้องการ</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {PACKAGES.map((pkg) => (
          <button
            key={pkg.key}
            onClick={() => setSelected(pkg.key)}
            className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
              selected === pkg.key
                ? "border-orange bg-orange/10 scale-[1.02]"
                : pkg.highlight
                  ? "border-white/30 bg-white/10"
                  : "border-white/10 bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">{pkg.emoji} <span className="text-white font-bold">{pkg.label}</span></span>
              <span className={`text-sm font-bold ${selected === pkg.key ? "text-orange" : "text-white"}`}>
                {pkg.price}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/70 mb-1">
              <span className="bg-white/10 px-2 py-0.5 rounded-full">⏳ {pkg.time}</span>
              {pkg.highlight && <span className="bg-orange/30 text-orange px-2 py-0.5 rounded-full font-semibold">แนะนำ</span>}
            </div>
            <p className="text-white/50 text-xs">{pkg.desc}</p>
          </button>
        ))}

        <div className="pt-2">
          <p className="text-white/30 text-xs text-center mb-3">
            💡 สั่งเครื่องดื่ม Coffee / Milk&Tea / Soda Zaa = +1 ชม. ทุกแก้ว
          </p>
          <button
            onClick={confirm}
            disabled={!selected || loading}
            className="w-full bg-orange text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 hover:bg-orange/90 transition-colors"
          >
            {loading ? "กำลังดำเนินการ..." : "ยืนยันแพ็กเกจ →"}
          </button>
        </div>
      </div>
    </div>
  );
}
