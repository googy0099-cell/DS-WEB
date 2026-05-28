"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";

interface ActiveSession {
  id: number;
  nickname: string;
  packageType: string;
  tableNumber: number;
  billName: string | null;
  prepRemaining: number;
  timeRemaining: number;
}

interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  memberCode: string;
  points: number;
  visitCount: number;
  phone: string | null;
  nickname: string | null;
  instagram: string | null;
  facebook: string | null;
  birthday: string | null;
  avatarUrl: string | null;
  createdAt: string;
  orders: { id: number; status: string; totalTHB: number; createdAt: string }[];
  activeSessions: ActiveSession[];
}

function fmtTime(secs: number) {
  if (secs >= 86400) return "ไม่จำกัดเวลา";
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function LiveTimer({ initial }: { initial: number }) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => {
    const t = setInterval(() => setSecs((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const color = secs >= 86400 ? "text-purple-400" : secs > 600 ? "text-green-400" : secs > 0 ? "text-yellow-400" : "text-red-400";
  return <span className={`font-mono font-bold text-xl ${color}`}>{fmtTime(secs)}</span>;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    nickname: "", phone: "", instagram: "", facebook: "", birthday: "", avatarUrl: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login?callbackUrl=/profile"); return; }
    if (status === "authenticated") {
      fetch("/api/profile/me").then(r => r.json()).then((data: UserProfile) => {
        setProfile(data);
        setForm({
          nickname: data.nickname ?? "",
          phone: data.phone ?? "",
          instagram: data.instagram ?? "",
          facebook: data.facebook ?? "",
          birthday: data.birthday ?? "",
          avatarUrl: data.avatarUrl ?? "",
        });
      });
    }
  }, [status, router]);

  async function uploadAvatar(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url as string;
  }

  async function handleSave() {
    setSaving(true); setError(""); setSuccess(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      const updated = await res.json();
      setProfile(prev => prev ? { ...prev, ...updated } : prev);
      setSuccess(true);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const avatarSrc = form.avatarUrl || (session?.user as { picture?: string })?.picture || null;

  if (status === "loading" || !profile) {
    return (
      <>
        <Navbar />
        <div className="pt-16 min-h-screen bg-cream flex items-center justify-center">
          <p className="text-gray-400">กำลังโหลด...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen bg-cream">
        {/* Header */}
        <div className="bg-navy px-4 py-10">
          <div className="max-w-lg mx-auto text-center">
            <div className="relative w-20 h-20 mx-auto mb-3">
              {avatarSrc ? (
                <Image src={avatarSrc} alt="avatar" fill className="rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-orange flex items-center justify-center text-white text-3xl font-bold">
                  {profile.firstName[0]?.toUpperCase()}
                </div>
              )}
              {editing && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-orange text-white rounded-full w-6 h-6 text-xs flex items-center justify-center shadow"
                >
                  ✏️
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const url = await uploadAvatar(f);
              if (url) {
                const updated = { ...form, avatarUrl: url };
                setForm(updated);
                await fetch("/api/profile", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(updated),
                });
                setProfile(prev => prev ? { ...prev, avatarUrl: url } : prev);
              }
            }} />
            <h1 className="text-cream font-bold text-xl">
              {form.nickname || profile.firstName} {!form.nickname && profile.lastName}
            </h1>
            <p className="text-cream/60 text-sm">@{profile.username}</p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {/* Member code */}
          <div className="bg-navy rounded-2xl p-5 text-center">
            <p className="text-cream/60 text-xs mb-1">รหัสสมาชิก</p>
            <p className="text-4xl font-bold text-orange tracking-[0.2em]">{profile.memberCode}</p>
            <p className="text-cream/40 text-xs mt-1">แสดงให้พนักงานเพื่อสะสมคะแนน</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-orange">{profile.points}</p>
              <p className="text-xs text-gray-500">คะแนน</p>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-sage">{profile.visitCount}</p>
              <p className="text-xs text-gray-500">ครั้งที่มา</p>
            </div>
          </div>

          {/* Success */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3 text-center">
              บันทึกข้อมูลเรียบร้อยแล้ว
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 text-center">
              {error}
            </div>
          )}

          {/* Profile info */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-navy">ข้อมูลส่วนตัว</h2>
              {!editing ? (
                <button onClick={() => setEditing(true)} className="text-xs text-orange font-semibold border border-orange/30 px-3 py-1 rounded-full">
                  แก้ไข
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="text-xs text-gray-400 border border-sand px-3 py-1 rounded-full">
                    ยกเลิก
                  </button>
                  <button onClick={handleSave} disabled={saving} className="text-xs text-white bg-orange px-3 py-1 rounded-full disabled:opacity-50">
                    {saving ? "..." : "บันทึก"}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {/* Read-only */}
              {[
                { label: "อีเมล", value: profile.email },
                { label: "สมัครเมื่อ", value: new Date(profile.createdAt).toLocaleDateString("th-TH") },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-400">{row.label}</span>
                  <span className="text-navy font-medium">{row.value}</span>
                </div>
              ))}

              {/* Editable fields */}
              {[
                { key: "nickname", label: "ชื่อเล่น", placeholder: "ชื่อเล่น" },
                { key: "phone", label: "เบอร์โทร", placeholder: "0812345678" },
                { key: "birthday", label: "วัน/เดือน/ปีเกิด", placeholder: "YYYY-MM-DD" },
                { key: "instagram", label: "Instagram", placeholder: "@username" },
                { key: "facebook", label: "Facebook", placeholder: "ชื่อ Facebook" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="flex justify-between items-center text-sm gap-2">
                  <span className="text-gray-400 shrink-0">{label}</span>
                  {editing ? (
                    <input
                      type={key === "birthday" ? "date" : "text"}
                      value={form[key as keyof typeof form]}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="border border-sand rounded-lg px-2 py-1 text-xs w-44 focus:border-orange focus:outline-none"
                    />
                  ) : (
                    <span className="text-navy font-medium text-right">
                      {form[key as keyof typeof form] || <span className="text-gray-300">-</span>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Active sessions */}
          {profile.activeSessions.length > 0 && (
            <div className="bg-navy rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-cream mb-3">⏱️ เวลาเล่นปัจจุบัน</h2>
              <div className="space-y-3">
                {profile.activeSessions.map((s) => (
                  <div key={s.id} className="bg-white/10 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-cream font-semibold text-sm">{s.nickname}</p>
                      <span className="text-cream/50 text-xs">โต๊ะ {s.tableNumber}</span>
                    </div>
                    {s.prepRemaining > 0 ? (
                      <p className="text-sky-300 text-sm">เตรียมตัว — เริ่มใน <LiveTimer initial={s.prepRemaining} /></p>
                    ) : (
                      <div>
                        <LiveTimer initial={s.timeRemaining} />
                        <p className="text-cream/40 text-xs mt-0.5">เหลือ</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent orders */}
          {profile.orders.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-navy mb-3">ออเดอร์ล่าสุด</h2>
              <div className="space-y-2">
                {profile.orders.map(order => (
                  <div key={order.id} className="flex justify-between text-sm py-2 border-b border-sand last:border-0">
                    <div>
                      <p className="font-medium text-navy">#{order.id} — {order.status}</p>
                      <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString("th-TH")}</p>
                    </div>
                    <p className="font-bold text-orange">฿{order.totalTHB}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/" className="flex-1 text-center bg-sand text-navy font-semibold py-3 rounded-xl text-sm">
              หน้าแรก
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex-1 bg-red-50 text-red-500 font-semibold py-3 rounded-xl text-sm"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
