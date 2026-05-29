"use client";

import { useState, useEffect } from "react";
import { X, Pencil, Trash2, KeyRound } from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";

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
  dicePoints: number;
  totalSpentTHB: number;
  visitCount: number;
  playMinutes: number;
  createdAt: string;
  googleId: string | null;
}

export default function AdminMembersPage() {
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "OWNER";

  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Member & { dicePointsStr: string }>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [resetPwMode, setResetPwMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

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

  function openEdit(m: Member) {
    setEditForm({
      firstName: m.firstName,
      lastName: m.lastName,
      nickname: m.nickname ?? "",
      email: m.email,
      phone: m.phone ?? "",
      instagram: m.instagram ?? "",
      facebook: m.facebook ?? "",
      birthday: m.birthday ?? "",
      dicePointsStr: String(m.dicePoints),
    });
    setSaveError("");
    setEditing(true);
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    setSaveError("");
    const { dicePointsStr, ...rest } = editForm;
    const body = { ...rest, dicePoints: Number(dicePointsStr ?? selected.dicePoints) };
    const res = await fetch(`/api/members/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) { setSaveError("บันทึกไม่สำเร็จ"); return; }
    const updated = { ...selected, ...rest, dicePoints: Number(dicePointsStr ?? selected.dicePoints) };
    setMembers(prev => prev.map(m => m.id === selected.id ? updated : m));
    setSelected(updated);
    setEditing(false);
  }

  async function deleteMember() {
    if (!selected) return;
    setDeleting(true);
    const res = await fetch(`/api/members/${selected.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) return;
    setMembers(prev => prev.filter(m => m.id !== selected.id));
    setSelected(null);
    setConfirmDelete(false);
  }

  async function resetPassword() {
    if (!selected || newPassword.length < 6) return;
    setResetSaving(true);
    setResetMsg("");
    const res = await fetch(`/api/members/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    setResetSaving(false);
    if (res.ok) {
      setResetMsg("✅ ตั้งรหัสผ่านใหม่สำเร็จ");
      setNewPassword("");
    } else {
      setResetMsg("❌ ไม่สำเร็จ");
    }
  }

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
                <th className="text-right p-3 text-navy font-semibold">แต้มเต๋า</th>
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
                    onClick={() => { setSelected(m); setEditing(false); setConfirmDelete(false); }}
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
                    <td className="p-3 text-right font-bold text-navy">🎲 {m.dicePoints}</td>
                    <td className="p-3 text-right text-gray-500 hidden md:table-cell">฿{m.totalSpentTHB}</td>
                    <td className="p-3 text-right text-gray-500 hidden md:table-cell">{m.visitCount} ครั้ง</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail / Edit modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4" onClick={() => { setSelected(null); setEditing(false); setConfirmDelete(false); setResetPwMode(false); setResetMsg(""); }}>
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-sand">
              <h2 className="font-bold text-navy">
                {editing ? "แก้ไขข้อมูล" : resetPwMode ? "ตั้งรหัสผ่านใหม่" : "ข้อมูลสมาชิก"}
              </h2>
              <div className="flex items-center gap-2">
                {isOwner && !editing && !resetPwMode && (
                  <>
                    <button onClick={() => openEdit(selected)} className="text-orange hover:text-orange/80 p-1">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => { setResetPwMode(true); setResetMsg(""); setNewPassword(""); }} className="text-blue-400 hover:text-blue-600 p-1" title="ตั้งรหัสผ่านใหม่">
                      <KeyRound size={16} />
                    </button>
                    <button onClick={() => setConfirmDelete(true)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                <button onClick={() => { setSelected(null); setEditing(false); setConfirmDelete(false); setResetPwMode(false); setResetMsg(""); }}>
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
            </div>

            {resetPwMode ? (
              <div className="p-5 space-y-4">
                {selected.googleId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700">
                    สมาชิกนี้เข้าสู่ระบบด้วย Google — ไม่จำเป็นต้องมีรหัสผ่าน สามารถกด "เข้าด้วย Google" ได้เลย
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setResetMsg(""); }}
                    placeholder="ตั้งรหัสผ่านใหม่"
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
                {resetMsg && (
                  <p className="text-sm font-medium text-center">{resetMsg}</p>
                )}
                <div className="flex gap-3">
                  <button onClick={() => { setResetPwMode(false); setResetMsg(""); setNewPassword(""); }} className="flex-1 border border-sand text-navy font-semibold py-2.5 rounded-xl text-sm">ยกเลิก</button>
                  <button onClick={resetPassword} disabled={resetSaving || newPassword.length < 6} className="flex-1 bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
                    {resetSaving ? "กำลังบันทึก..." : "ตั้งรหัสผ่าน"}
                  </button>
                </div>
              </div>
            ) : confirmDelete ? (
              <div className="p-5 text-center space-y-4">
                <p className="text-2xl">⚠️</p>
                <p className="font-bold text-navy">ลบสมาชิก</p>
                <p className="text-sm text-gray-500">
                  ต้องการลบ <span className="font-semibold text-navy">{selected.firstName} {selected.lastName}</span> ออกจากระบบ?<br />
                  การกระทำนี้ไม่สามารถย้อนกลับได้
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-sand text-navy font-semibold py-2.5 rounded-xl text-sm">ยกเลิก</button>
                  <button onClick={deleteMember} disabled={deleting} className="flex-1 bg-red-500 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
                    {deleting ? "กำลังลบ..." : "ลบสมาชิก"}
                  </button>
                </div>
              </div>
            ) : editing ? (
              <div className="p-5 space-y-3">
                {([
                  { label: "ชื่อ", field: "firstName" },
                  { label: "นามสกุล", field: "lastName" },
                  { label: "ชื่อเล่น", field: "nickname" },
                  { label: "อีเมล", field: "email", type: "email" },
                  { label: "เบอร์โทร", field: "phone" },
                  { label: "Instagram", field: "instagram" },
                  { label: "Facebook", field: "facebook" },
                  { label: "วันเกิด", field: "birthday", type: "date" },
                ] as { label: string; field: keyof Member; type?: string }[]).map(({ label, field, type = "text" }) => (
                  <div key={field}>
                    <label className="text-xs font-medium text-navy block mb-1">{label}</label>
                    <input
                      type={type}
                      value={(editForm[field] as string) ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                      className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                    />
                  </div>
                ))}

                {/* Dice points field */}
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">🎲 แต้มเต๋า</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.dicePointsStr ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, dicePointsStr: e.target.value }))}
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>

                {saveError && <p className="text-sm text-red-500">{saveError}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setEditing(false)} className="flex-1 border border-sand text-navy font-semibold py-2.5 rounded-xl text-sm">ยกเลิก</button>
                  <button onClick={saveEdit} disabled={saving} className="flex-1 bg-orange text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
                    {saving ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                </div>
              </div>
            ) : (
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
                <div className="grid grid-cols-2 gap-2 text-center">
                  {[
                    { label: "แต้มเต๋า", value: `🎲 ${selected.dicePoints}`, color: "text-orange" },
                    { label: "คะแนนสะสม", value: `⭐ ${selected.points}`, color: "text-yellow-600" },
                    { label: "ยอดใช้จ่าย", value: `฿${selected.totalSpentTHB.toLocaleString()}`, color: "text-navy" },
                    { label: "เข้าร้าน", value: `${selected.visitCount} ครั้ง`, color: "text-sage" },
                    { label: "ชั่วโมงเล่นสะสม", value: `${Math.floor((selected.playMinutes ?? 0) / 60)} ชม. ${(selected.playMinutes ?? 0) % 60} น.`, color: "text-purple-500" },
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
