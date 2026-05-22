"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import Image from "next/image";

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  memberCode: string;
  phone: string | null;
  nickname: string | null;
  instagram: string | null;
  facebook: string | null;
  birthday: string | null;
  avatarUrl: string | null;
  points: number;
  totalSpentTHB: number;
  visitCount: number;
  createdAt: string;
  googleId: string | null;
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/members")
      .then(r => r.json())
      .then((data: Member[]) => { setMembers(data); setLoading(false); });
  }, []);

  const filtered = members.filter(m =>
    !search || m.firstName.includes(search) || m.lastName.includes(search) ||
    m.email.includes(search) || m.memberCode.includes(search) ||
    (m.nickname ?? "").includes(search) || (m.username ?? "").includes(search)
  );

  const googleAvatarUrl = (googleId: string | null) =>
    googleId ? `https://lh3.googleusercontent.com/a/${googleId}=s96-c` : null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">สมาชิกทั้งหมด</h1>
          <p className="text-gray-400 text-sm">{members.length} คน</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา..."
          className="border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none w-44"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 border-b border-sand">
              <tr>
                <th className="text-left p-3 text-navy font-semibold">สมาชิก</th>
                <th className="text-left p-3 text-navy font-semibold">รหัส</th>
                <th className="text-right p-3 text-navy font-semibold">คะแนน</th>
                <th className="text-right p-3 text-navy font-semibold hidden md:table-cell">ใช้จ่าย</th>
                <th className="text-right p-3 text-navy font-semibold hidden md:table-cell">เข้าร้าน</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center text-gray-400 py-8">กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-gray-400 py-8">ไม่พบสมาชิก</td></tr>
              ) : filtered.map(m => {
                const avatar = m.avatarUrl || googleAvatarUrl(m.googleId);
                return (
                  <tr
                    key={m.id}
                    className="border-b border-sand/50 last:border-0 hover:bg-sand/20 cursor-pointer transition-colors"
                    onClick={() => setSelected(m)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {avatar ? (
                          <Image src={avatar} alt="" width={32} height={32} className="rounded-full object-cover w-8 h-8 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-orange/20 flex items-center justify-center text-orange font-bold text-sm shrink-0">
                            {m.firstName[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-navy">{m.nickname || `${m.firstName} ${m.lastName}`}</p>
                          <p className="text-gray-400 text-xs">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-mono font-bold text-orange bg-orange/10 px-2 py-0.5 rounded">{m.memberCode}</span>
                    </td>
                    <td className="p-3 text-right font-bold text-navy">{m.points}</td>
                    <td className="p-3 text-right text-gray-500 hidden md:table-cell">฿{m.totalSpentTHB}</td>
                    <td className="p-3 text-right text-gray-500 hidden md:table-cell">{m.visitCount} ครั้ง</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-sand">
              <h2 className="font-bold text-navy">ข้อมูลสมาชิก</h2>
              <button onClick={() => setSelected(null)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Avatar + name */}
              <div className="text-center">
                {(() => {
                  const av = selected.avatarUrl || googleAvatarUrl(selected.googleId);
                  return av ? (
                    <Image src={av} alt="" width={72} height={72} className="rounded-full object-cover mx-auto mb-2 w-18 h-18" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-orange/20 flex items-center justify-center text-orange text-2xl font-bold mx-auto mb-2">
                      {selected.firstName[0]?.toUpperCase()}
                    </div>
                  );
                })()}
                <p className="font-bold text-navy text-lg">{selected.firstName} {selected.lastName}</p>
                {selected.nickname && <p className="text-gray-400 text-sm">"{selected.nickname}"</p>}
                <p className="text-gray-400 text-sm">@{selected.username}</p>
              </div>

              {/* Member code */}
              <div className="bg-navy rounded-xl p-3 text-center">
                <p className="text-cream/60 text-xs mb-1">รหัสสมาชิก</p>
                <p className="text-2xl font-bold text-orange tracking-widest">{selected.memberCode}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "คะแนน", value: selected.points, color: "text-orange" },
                  { label: "ยอดใช้จ่าย", value: `฿${selected.totalSpentTHB}`, color: "text-navy" },
                  { label: "เข้าร้าน", value: `${selected.visitCount} ครั้ง`, color: "text-sage" },
                ].map(s => (
                  <div key={s.label} className="bg-sand/40 rounded-xl p-3">
                    <p className={`font-bold text-sm ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                {[
                  { label: "อีเมล", value: selected.email },
                  { label: "เบอร์โทร", value: selected.phone },
                  { label: "วันเกิด", value: selected.birthday },
                  { label: "Instagram", value: selected.instagram },
                  { label: "Facebook", value: selected.facebook },
                  { label: "เข้าร้านด้วย", value: selected.googleId ? "Google" : "Email/Password" },
                  { label: "สมัครเมื่อ", value: new Date(selected.createdAt).toLocaleDateString("th-TH") },
                ].map(row => row.value && (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-gray-400">{row.label}</span>
                    <span className="text-navy font-medium text-right max-w-[60%] truncate">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
