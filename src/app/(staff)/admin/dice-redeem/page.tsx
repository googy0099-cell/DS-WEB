"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type RewardItem = { id: number; nameTh: string; description: string; cost: number; imageUrl: string | null; isAvailable: boolean };
type MemberInfo = { id: number; firstName: string; username: string; memberCode: string; dicePoints: number };

export default function DiceRedeemPage() {
  const { data: rewards } = useSWR<RewardItem[]>("/api/rewards", fetcher);

  const [code, setCode] = useState("");
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [memberError, setMemberError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const available = rewards?.filter((r) => r.isAvailable) ?? [];

  const lookupMember = useCallback(async () => {
    if (!code.trim()) return;
    setLookingUp(true); setMemberError(""); setMember(null); setSelectedReward(null); setResult(null);
    const res = await fetch(`/api/pos/member?code=${encodeURIComponent(code.trim().toUpperCase())}`);
    setLookingUp(false);
    if (res.ok) setMember(await res.json());
    else setMemberError("ไม่พบสมาชิก");
  }, [code]);

  async function confirmRedeem() {
    if (!member || !selectedReward) return;
    setConfirming(true); setResult(null);
    const res = await fetch("/api/dice/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberCode: member.memberCode, rewardId: selectedReward.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult({ ok: true, text: `แลก "${selectedReward.nameTh}" ให้ ${member.firstName} สำเร็จ! เหลือ ${data.remaining} 🎲` });
      setMember((prev) => prev ? { ...prev, dicePoints: data.remaining } : prev);
      setSelectedReward(null);
    } else {
      setResult({ ok: false, text: data.error ?? "เกิดข้อผิดพลาด" });
    }
    setConfirming(false);
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold text-navy">🎲 แลกแต้มลูกเต๋า</h1>

      {/* Step 1: member lookup */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-navy">1. ค้นหาสมาชิก</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && lookupMember()}
            placeholder="รหัสสมาชิก เช่น DS-1234"
            className="flex-1 border-2 border-sand rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange uppercase"
          />
          <button
            onClick={lookupMember}
            disabled={lookingUp || !code.trim()}
            className="px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-xl disabled:opacity-40"
          >
            {lookingUp ? "..." : "ค้นหา"}
          </button>
        </div>
        {memberError && <p className="text-red-500 text-sm">{memberError}</p>}
        {member && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-navy text-base">{member.firstName}</p>
              <p className="text-xs text-gray-400">@{member.username} · {member.memberCode}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-orange">{member.dicePoints}</p>
              <p className="text-xs text-gray-400">🎲 แต้ม</p>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: select reward */}
      {member && (
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-navy">2. เลือกรางวัล</p>
          {available.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">ยังไม่มีรายการของแลก</p>
          ) : (
            <div className="space-y-2">
              {available.map((r) => {
                const canAfford = member.dicePoints >= r.cost;
                const isSelected = selectedReward?.id === r.id;
                return (
                  <button
                    key={r.id}
                    disabled={!canAfford}
                    onClick={() => setSelectedReward(isSelected ? null : r)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      !canAfford ? "border-sand opacity-40 cursor-not-allowed" :
                      isSelected ? "border-orange bg-orange/5" : "border-sand hover:border-orange/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-navy text-sm">{r.nameTh}</p>
                      <span className={`text-sm font-bold ${isSelected ? "text-orange" : "text-gray-500"}`}>🎲 {r.cost}</span>
                    </div>
                    {r.description && <p className="text-xs text-gray-400 mt-0.5">{r.description}</p>}
                    {!canAfford && <p className="text-xs text-red-400 mt-0.5">แต้มไม่พอ (ขาด {r.cost - member.dicePoints} 🎲)</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3: confirm */}
      {member && selectedReward && (
        <div className="bg-orange/5 border-2 border-orange rounded-2xl p-5 space-y-3">
          <p className="text-sm font-semibold text-navy">3. ยืนยันการแลก</p>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">สมาชิก</span><span className="font-bold text-navy">{member.firstName} ({member.memberCode})</span></div>
            <div className="flex justify-between"><span className="text-gray-500">รางวัล</span><span className="font-bold text-navy">{selectedReward.nameTh}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">ใช้แต้ม</span><span className="font-bold text-orange">{selectedReward.cost} 🎲</span></div>
            <div className="flex justify-between"><span className="text-gray-500">คงเหลือ</span><span className="font-bold text-navy">{member.dicePoints - selectedReward.cost} 🎲</span></div>
          </div>
          <button
            onClick={confirmRedeem}
            disabled={confirming}
            className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40"
          >
            {confirming ? "กำลังแลก..." : "✅ ยืนยันแลกรางวัล"}
          </button>
        </div>
      )}

      {result && (
        <div className={`rounded-2xl p-4 text-sm text-center font-semibold ${result.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {result.text}
        </div>
      )}
    </div>
  );
}
