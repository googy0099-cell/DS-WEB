"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import DateRangePicker from "@/components/admin/DateRangePicker";

function todayBKK() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
function addDays(d: string, n: number) {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error("fetch failed");
  return r.json();
};

type Player = { nickname: string; packageType: string; packagePrice: number; memberName: string | null; memberCode: string | null };
type Party = {
  id: number; name: string; tableNumber: number; status: string;
  date: string; openedAt: string;
  playerCount: number; memberCount: number; pkgSummary: string;
  gameRevenue: number; foodRevenue: number; totalRevenue: number;
  players: Player[];
};
type Summary = {
  parties: Party[];
  totalParties: number; totalPlayers: number;
  totalRevenue: number; totalGameRevenue: number; totalFoodRevenue: number;
  avgPlayers: number; avgRevenue: number;
};

const PKG_COLOR: Record<string, string> = {
  A: "bg-sky-100 text-sky-700",
  B: "bg-green-100 text-green-700",
  C: "bg-purple-100 text-purple-700",
  D: "bg-amber-100 text-amber-700",
};

export default function PartiesReportPage() {
  const today = todayBKK();
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, isLoading } = useSWR<Summary>(
    `/api/analytics/parties?from=${from}&to=${to}`,
    fetcher,
  );

  const parties = data?.parties ?? [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/analytics" className="text-gray-400 hover:text-navy text-sm">← กลับ</Link>
        <h1 className="text-xl font-bold text-navy">ประวัติปาร์ตี้</h1>
      </div>

      <div className="mb-4">
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {/* Summary cards */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: "จำนวนตี้", value: data.totalParties.toLocaleString(), sub: "ตี้" },
            { label: "ผู้เล่นรวม", value: data.totalPlayers.toLocaleString(), sub: `เฉลี่ย ${data.avgPlayers} คน/ตี้` },
            { label: "รายได้รวม", value: `฿${data.totalRevenue.toLocaleString()}`, sub: `เฉลี่ย ฿${data.avgRevenue.toLocaleString()}/ตี้` },
            { label: "เกม / อาหาร", value: `฿${data.totalGameRevenue.toLocaleString()}`, sub: `อาหาร ฿${data.totalFoodRevenue.toLocaleString()}` },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">{c.label}</p>
              <p className="text-xl font-bold text-navy leading-tight">{c.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Party list */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))
        ) : parties.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400">ไม่มีข้อมูลในช่วงนี้</div>
        ) : (
          parties.map((party) => {
            const isOpen = expanded === party.id;
            return (
              <div key={party.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Header row */}
                <button
                  className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-sand/20 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : party.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-navy text-sm">{party.name}</span>
                      <span className="text-xs text-gray-400">โต๊ะ {party.tableNumber}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${party.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {party.status === "ACTIVE" ? "กำลังเล่น" : "ปิดแล้ว"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-gray-400">{party.openedAt.replace(" ", " เวลา ")}</span>
                      <span className="text-xs text-gray-500">{party.playerCount} คน</span>
                      {party.pkgSummary && <span className="text-xs text-gray-400">{party.pkgSummary}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-navy text-sm">฿{party.totalRevenue.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400">รวม</p>
                  </div>
                  <span className={`text-gray-300 text-sm transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-sand px-4 py-3 space-y-3 bg-sand/10">
                    {/* Revenue breakdown */}
                    <div className="flex gap-4 text-sm">
                      <div><span className="text-gray-400 text-xs">ค่าเกม </span><span className="font-semibold text-navy">฿{party.gameRevenue.toLocaleString()}</span></div>
                      <div><span className="text-gray-400 text-xs">อาหาร/เครื่องดื่ม </span><span className="font-semibold text-navy">฿{party.foodRevenue.toLocaleString()}</span></div>
                    </div>

                    {/* Player list */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 mb-2">ผู้เล่น ({party.players.length} คน, สมาชิก {party.memberCount} คน)</p>
                      <div className="space-y-1.5">
                        {party.players.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${PKG_COLOR[p.packageType] ?? "bg-gray-100 text-gray-600"}`}>
                              {p.packageType}
                            </span>
                            <span className="text-navy font-medium flex-1">{p.nickname}</span>
                            {p.memberName && (
                              <span className="text-xs text-gray-400">{p.memberName} · {p.memberCode}</span>
                            )}
                            <span className="text-xs text-gray-400 shrink-0">
                              {p.packagePrice > 0 ? `฿${p.packagePrice}` : "ฟรี"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
