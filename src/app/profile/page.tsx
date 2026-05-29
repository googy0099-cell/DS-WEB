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
  dicePoints: number;
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

interface Notif {
  id: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface RewardItem {
  id: number;
  nameTh: string;
  description: string;
  cost: number;
  imageUrl: string | null;
  isAvailable: boolean;
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
  const [infoVisible, setInfoVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    nickname: "", phone: "", instagram: "", facebook: "", birthday: "", avatarUrl: "",
  });

  // Transfer
  const [transferCode, setTransferCode] = useState("");
  const [transferAmount, setTransferAmount] = useState(1);
  const [transferring, setTransferring] = useState(false);
  const [transferMsg, setTransferMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Rewards catalog
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [rewardsOpen, setRewardsOpen] = useState(false);

  // Notifications
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifs.filter(n => !n.isRead).length;

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login?callbackUrl=/profile"); return; }
    if (status === "authenticated") {
      fetch("/api/profile/me").then(r => r.json()).then((data: UserProfile) => {
        setProfile(data);
        setForm({ nickname: data.nickname ?? "", phone: data.phone ?? "", instagram: data.instagram ?? "", facebook: data.facebook ?? "", birthday: data.birthday ?? "", avatarUrl: data.avatarUrl ?? "" });
      });
      fetch("/api/notifications").then(r => r.json()).then((data: Notif[]) => {
        if (Array.isArray(data)) setNotifs(data);
      });
      fetch("/api/rewards").then(r => r.json()).then((data: RewardItem[]) => {
        if (Array.isArray(data)) setRewards(data.filter(r => r.isAvailable));
      });
    }
  }, [status, router]);

  async function uploadAvatar(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    return (await res.json()).url as string;
  }

  async function handleSave() {
    setSaving(true); setError(""); setSuccess(false);
    try {
      const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
      const updated = await res.json();
      setProfile(prev => prev ? { ...prev, ...updated } : prev);
      setSuccess(true); setEditing(false);
    } finally { setSaving(false); }
  }

  async function handleTransfer() {
    if (!transferCode.trim() || transferAmount < 1) return;
    setTransferring(true); setTransferMsg(null);
    try {
      const res = await fetch("/api/dice/transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientCode: transferCode.trim(), amount: transferAmount }) });
      const data = await res.json();
      if (!res.ok) setTransferMsg({ ok: false, text: data.error ?? "เกิดข้อผิดพลาด" });
      else {
        setTransferMsg({ ok: true, text: `โอน ${transferAmount} 🎲 ให้ ${data.recipientName} เรียบร้อย!` });
        setTransferCode(""); setTransferAmount(1);
        setProfile(prev => prev ? { ...prev, dicePoints: prev.dicePoints - transferAmount } : prev);
      }
    } finally { setTransferring(false); }
  }

  function openNotif() {
    setNotifOpen(true);
    if (unreadCount > 0) {
      fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
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
        <div className="bg-navy px-4 py-10">
          <div className="max-w-lg mx-auto text-center relative">
            <button onClick={openNotif} className="absolute top-0 right-0 p-2">
              <span className="text-2xl relative inline-block">
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>
                )}
              </span>
            </button>
            <div className="relative w-20 h-20 mx-auto mb-3">
              {avatarSrc ? (
                <Image src={avatarSrc} alt="avatar" fill className="rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-orange flex items-center justify-center text-white text-3xl font-bold">
                  {profile.firstName[0]?.toUpperCase()}
                </div>
              )}
              {editing && (
                <button onClick={() => fileRef.current?.click()} className="absolute bottom-0 right-0 bg-orange text-white rounded-full w-6 h-6 text-xs flex items-center justify-center shadow">✏️</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const url = await uploadAvatar(f);
              if (url) {
                const updated = { ...form, avatarUrl: url };
                setForm(updated);
                await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
                setProfile(prev => prev ? { ...prev, avatarUrl: url } : prev);
              }
            }} />
            <h1 className="text-cream font-bold text-xl">{form.nickname || profile.firstName} {!form.nickname && profile.lastName}</h1>
            <p className="text-cream/60 text-sm">@{profile.username}</p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {/* Member code */}
          <div className="bg-navy rounded-2xl p-5 text-center">
            <p className="text-cream/60 text-xs mb-1">รหัสสมาชิก</p>
            <p className="text-4xl font-bold text-orange tracking-[0.2em]">{profile.memberCode}</p>
            <p className="text-cream/40 text-xs mt-1">แสดงให้พนักงานเพื่อสะสมแต้ม</p>
          </div>

          {/* Personal info — moved here, right under member code */}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3 text-center">บันทึกข้อมูลเรียบร้อยแล้ว</div>}
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 text-center">{error}</div>}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-navy">ข้อมูลส่วนตัว</h2>
              <div className="flex gap-2">
                <button onClick={() => setInfoVisible(v => !v)} className="text-xs text-gray-400 border border-sand px-3 py-1 rounded-full">
                  {infoVisible ? "ซ่อน" : "แสดง"}
                </button>
                {infoVisible && !editing && <button onClick={() => setEditing(true)} className="text-xs text-orange font-semibold border border-orange/30 px-3 py-1 rounded-full">แก้ไข</button>}
                {infoVisible && editing && (
                  <>
                    <button onClick={() => setEditing(false)} className="text-xs text-gray-400 border border-sand px-3 py-1 rounded-full">ยกเลิก</button>
                    <button onClick={handleSave} disabled={saving} className="text-xs text-white bg-orange px-3 py-1 rounded-full disabled:opacity-50">{saving ? "..." : "บันทึก"}</button>
                  </>
                )}
              </div>
            </div>
            {!infoVisible ? (
              <p className="text-gray-300 text-sm text-center py-2">ซ่อนข้อมูล — กด &quot;แสดง&quot; เพื่อดู</p>
            ) : (
              <div className="space-y-3">
                {[{ label: "อีเมล", value: profile.email }, { label: "สมัครเมื่อ", value: new Date(profile.createdAt).toLocaleDateString("th-TH") }].map(row => (
                  <div key={row.label} className="flex justify-between text-sm"><span className="text-gray-400">{row.label}</span><span className="text-navy font-medium">{row.value}</span></div>
                ))}
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
                      <input type={key === "birthday" ? "date" : "text"} value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} className="border border-sand rounded-lg px-2 py-1 text-xs w-44 focus:border-orange focus:outline-none" />
                    ) : (
                      <span className="text-navy font-medium text-right">{form[key as keyof typeof form] || <span className="text-gray-300">-</span>}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dice Points */}
          <div className="bg-gradient-to-br from-orange to-amber-600 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/80 text-sm font-semibold">แต้มลูกเต๋า</p>
              <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">49฿ = 1 🎲</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-5xl">🎲</span>
              <div>
                <p className="text-5xl font-bold text-white leading-none">{profile.dicePoints}</p>
                <p className="text-white/60 text-xs mt-1">ลูกเต๋า</p>
              </div>
            </div>

            <button
              onClick={() => setRewardsOpen(true)}
              className="w-full bg-white/15 hover:bg-white/25 rounded-xl py-3 text-white font-bold text-sm transition-all"
            >
              🎁 ดูรายการของแลก
            </button>
            <p className="text-white/50 text-xs text-center mt-2">ติดต่อพนักงานเพื่อแลกรางวัล</p>
          </div>

          {/* Transfer */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-navy mb-3">🎁 ส่งของขวัญให้เพื่อน</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">รหัสสมาชิก 4 หลัก</label>
                <input
                  value={transferCode}
                  onChange={e => setTransferCode(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="0000"
                  maxLength={4}
                  className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm text-center font-bold tracking-widest focus:border-orange focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">จำนวนลูกเต๋า</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setTransferAmount(a => Math.max(1, a - 1))} className="w-9 h-9 rounded-full bg-sand text-navy font-bold text-lg flex items-center justify-center">−</button>
                  <span className="font-bold text-navy text-xl w-8 text-center">{transferAmount}</span>
                  <button onClick={() => setTransferAmount(a => Math.min(profile.dicePoints, a + 1))} className="w-9 h-9 rounded-full bg-sand text-navy font-bold text-lg flex items-center justify-center">+</button>
                  <span className="text-sm text-gray-400">/ {profile.dicePoints} 🎲</span>
                </div>
              </div>
              {transferMsg && (
                <div className={`rounded-xl p-2.5 text-sm text-center ${transferMsg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                  {transferMsg.text}
                </div>
              )}
              <button onClick={handleTransfer} disabled={transferring || !transferCode.trim() || transferAmount < 1 || transferAmount > profile.dicePoints}
                className="w-full bg-orange text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40 transition-opacity">
                {transferring ? "กำลังโอน..." : `โอน ${transferAmount} 🎲`}
              </button>
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
                      <div><LiveTimer initial={s.timeRemaining} /><p className="text-cream/40 text-xs mt-0.5">เหลือ</p></div>
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
            <Link href="/" className="flex-1 text-center bg-sand text-navy font-semibold py-3 rounded-xl text-sm">หน้าแรก</Link>
            <button onClick={() => signOut({ callbackUrl: "/" })} className="flex-1 bg-red-50 text-red-500 font-semibold py-3 rounded-xl text-sm">ออกจากระบบ</button>
          </div>
        </div>
      </div>

      {/* Inbox modal */}
      {notifOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setNotifOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm max-h-[70vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-sand flex items-center justify-between rounded-t-3xl">
              <h3 className="font-bold text-navy text-lg">🔔 กล่องข้อความ</h3>
              <button onClick={() => setNotifOpen(false)} className="text-gray-400 text-sm">ปิด</button>
            </div>
            {notifs.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">ยังไม่มีการแจ้งเตือน</div>
            ) : (
              <div className="divide-y divide-sand">
                {notifs.map(n => (
                  <div key={n.id} className={`px-5 py-4 ${n.isRead ? "" : "bg-orange/5"}`}>
                    <p className={`text-sm ${n.isRead ? "text-navy" : "text-navy font-semibold"}`}>{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString("th-TH")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rewards catalog modal */}
      {rewardsOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setRewardsOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-sand flex items-center justify-between rounded-t-3xl">
              <div>
                <h3 className="font-bold text-navy text-lg">🎁 ของแลกแต้ม</h3>
                <p className="text-xs text-gray-400">คุณมี {profile.dicePoints} 🎲</p>
              </div>
              <button onClick={() => setRewardsOpen(false)} className="text-gray-400 text-sm">ปิด</button>
            </div>
            <div className="p-5 space-y-3">
              {rewards.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">ยังไม่มีรายการของแลก</p>
              ) : (
                rewards.map((r) => (
                  <div key={r.id} className={`flex items-center gap-3 border-2 rounded-2xl p-2.5 ${profile.dicePoints >= r.cost ? "border-sand" : "border-sand opacity-60"}`}>
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-sand/40">
                      {r.imageUrl ? (
                        <Image src={r.imageUrl} alt={r.nameTh} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">🎁</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-navy text-sm leading-tight">{r.nameTh}</p>
                      {r.description && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{r.description}</p>}
                      <p className={`text-[10px] mt-0.5 ${profile.dicePoints >= r.cost ? "text-green-500" : "text-red-400"}`}>
                        {profile.dicePoints >= r.cost ? "แลกได้" : `ขาดอีก ${r.cost - profile.dicePoints}`}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-orange shrink-0">🎲 {r.cost}</p>
                  </div>
                ))
              )}
              <div className="bg-orange/10 border border-orange/30 rounded-2xl p-4 text-center">
                <p className="text-sm font-semibold text-orange">ติดต่อพนักงานเพื่อแลกรางวัล</p>
                <p className="text-xs text-gray-400 mt-1">แสดงรหัสสมาชิก <span className="font-bold text-navy">{profile.memberCode}</span> ให้พนักงาน</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
