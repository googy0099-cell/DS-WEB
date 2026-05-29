"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";

type RewardItem = { id: number; nameTh: string; description: string; cost: number; imageUrl: string | null; isAvailable: boolean };
type MemberInfo = { id: number; firstName: string; username: string; memberCode: string; dicePoints: number };

export default function DiceRedeemButton() {
  const [open, setOpen] = useState(false);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [selected, setSelected] = useState<RewardItem | null>(null);

  const [code, setCode] = useState("");
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [memberError, setMemberError] = useState("");
  const [memberLoading, setMemberLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const loadRewards = useCallback(async () => {
    const res = await fetch("/api/rewards").then((r) => r.json()).catch(() => []);
    setRewards(Array.isArray(res) ? res.filter((r: RewardItem) => r.isAvailable) : []);
  }, []);

  function openModal() { setOpen(true); loadRewards(); }
  function closeModal() {
    setOpen(false); setSelected(null);
    setCode(""); setMember(null); setMemberError("");
    setResult(null);
  }

  function onCodeChange(val: string) {
    setCode(val);
    setMemberError(""); setMember(null);
    if (!val.trim()) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setMemberLoading(true);
      const res = await fetch(`/api/pos/member?code=${encodeURIComponent(val.trim().toUpperCase())}`);
      setMemberLoading(false);
      if (res.ok) setMember(await res.json());
      else setMemberError("ไม่พบสมาชิก");
    }, 500);
  }

  async function confirmRedeem() {
    if (!member || !selected) return;
    setConfirming(true); setResult(null);
    const res = await fetch("/api/dice/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberCode: member.memberCode, rewardId: selected.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult({ ok: true, text: `แลก "${selected.nameTh}" ให้ ${member.firstName} สำเร็จ! เหลือ ${data.remaining} 🎲` });
      setMember((prev) => prev ? { ...prev, dicePoints: data.remaining } : prev);
      setSelected(null); setCode(""); setMember(null);
    } else {
      setResult({ ok: false, text: data.error ?? "เกิดข้อผิดพลาด" });
    }
    setConfirming(false);
  }

  const canConfirm = member && selected && member.dicePoints >= selected.cost;

  return (
    <>
      <button
        onClick={openModal}
        className="bg-amber-500 hover:bg-amber-400 text-white font-bold px-5 py-2.5 rounded-2xl text-sm shadow-lg transition-colors"
      >
        🎲 แลกแต้ม
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-sand shrink-0">
              <h3 className="font-bold text-navy text-lg">🎲 แลกแต้มลูกเต๋า</h3>
              <button onClick={closeModal} className="text-gray-400 text-2xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Result banner */}
              {result && (
                <div className={`rounded-xl p-3 text-sm text-center font-semibold ${result.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                  {result.text}
                </div>
              )}

              {/* Step 1: select reward */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">1. เลือกรางวัล</p>
                {rewards.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">ยังไม่มีรายการของแลก</p>
                ) : (
                  <div className="space-y-2">
                    {rewards.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelected(selected?.id === r.id ? null : r)}
                        className={`w-full text-left flex items-center gap-3 rounded-2xl border-2 p-2.5 transition-all ${selected?.id === r.id ? "border-orange bg-orange/5" : "border-sand hover:border-orange/40"}`}
                      >
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-sand/40">
                          {r.imageUrl ? (
                            <Image src={r.imageUrl} alt={r.nameTh} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">🎁</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-navy text-sm leading-tight">{r.nameTh}</p>
                          {r.description && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{r.description}</p>}
                        </div>
                        <p className={`text-sm font-bold shrink-0 ${selected?.id === r.id ? "text-orange" : "text-gray-500"}`}>🎲 {r.cost}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 2: member code */}
              {selected && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">2. รหัสสมาชิก</p>
                  <input
                    value={code}
                    onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
                    placeholder="DS-XXXX"
                    className="w-full border-2 border-sand rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange uppercase"
                    autoFocus
                  />
                  {memberLoading && <p className="text-xs text-gray-400 mt-1">กำลังค้นหา...</p>}
                  {memberError && <p className="text-xs text-red-500 mt-1">{memberError}</p>}
                  {member && (
                    <div className={`mt-2 rounded-xl px-3 py-2.5 flex items-center justify-between ${member.dicePoints >= selected.cost ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                      <div>
                        <p className="text-sm font-bold text-navy">{member.firstName} <span className="text-gray-400 font-normal text-xs">@{member.username}</span></p>
                        <p className="text-xs text-gray-500">{member.memberCode} · 🎲 {member.dicePoints} แต้ม</p>
                      </div>
                      {member.dicePoints < selected.cost && (
                        <p className="text-xs text-red-500 font-semibold">ขาด {selected.cost - member.dicePoints} 🎲</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: summary */}
              {selected && member && member.dicePoints >= selected.cost && (
                <div className="bg-orange/5 border border-orange/30 rounded-2xl p-4 space-y-2 text-sm">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">3. ยืนยัน</p>
                  <div className="flex justify-between"><span className="text-gray-500">สมาชิก</span><span className="font-bold text-navy">{member.firstName} ({member.memberCode})</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">รางวัล</span><span className="font-bold text-navy">{selected.nameTh}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">ใช้แต้ม</span><span className="font-bold text-orange">−{selected.cost} 🎲</span></div>
                  <div className="flex justify-between border-t border-orange/20 pt-2"><span className="text-gray-500">คงเหลือ</span><span className="font-bold text-navy">{member.dicePoints - selected.cost} 🎲</span></div>
                </div>
              )}
            </div>

            <div className="border-t border-sand p-4 shrink-0">
              <button
                onClick={confirmRedeem}
                disabled={!canConfirm || confirming}
                className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40 transition-opacity"
              >
                {confirming ? "กำลังแลก..." : "✅ ยืนยันแลกรางวัล"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
