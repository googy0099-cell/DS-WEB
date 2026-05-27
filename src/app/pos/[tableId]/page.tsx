"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";

export default function PosJoinPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function next() {
    if (!nickname.trim()) return;
    setLoading(true);
    setError("");
    // Validate table exists
    const res = await fetch(`/api/pos/table/${tableId}`);
    if (!res.ok) {
      setError("ไม่พบโต๊ะนี้ กรุณาสแกน QR ใหม่");
      setLoading(false);
      return;
    }
    // Pass nickname via sessionStorage to next step
    sessionStorage.setItem("pos_nickname", nickname.trim());
    sessionStorage.setItem("pos_tableId", tableId);
    router.push(`/pos/${tableId}/package`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy to-indigo-900 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange flex items-center justify-center mx-auto mb-3 shadow-lg">
          <span className="text-3xl">🎲</span>
        </div>
        <h1 className="text-white text-xl font-bold">DICE SHOP</h1>
        <p className="text-white/50 text-sm">โต๊ะ {tableId}</p>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 space-y-5">
        <div className="text-center">
          <h2 className="text-navy font-bold text-xl">ยินดีต้อนรับ!</h2>
          <p className="text-gray-400 text-sm mt-1">ระบุชื่อเล่นเพื่อเข้าร่วม</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-navy block mb-1.5">ชื่อเล่น</label>
          <input
            autoFocus
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && next()}
            placeholder="เช่น ปลา, มิ้ง, ต้น..."
            className="w-full border-2 border-sand rounded-2xl px-4 py-3 text-base focus:border-orange focus:outline-none"
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>

        <button
          onClick={next}
          disabled={loading || !nickname.trim()}
          className="w-full bg-orange text-white font-bold py-3.5 rounded-2xl text-base disabled:opacity-50 hover:bg-orange/90 transition-colors"
        >
          {loading ? "กำลังตรวจสอบ..." : "ถัดไป →"}
        </button>
      </div>
    </div>
  );
}
