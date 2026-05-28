"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import type { MenuItemType, CartSelectedAddon, CartSelectedOption } from "@/types";

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

const REDEEM_COST = 10;
const DRINK_CATS = ["coffee", "milktea", "soda"];

const REDEEM_OPTIONS = [
  { key: "A", label: "Package A", desc: "น้ำ 1 แก้ว + เล่นฟรี 1 ชม.", cost: REDEEM_COST },
  { key: "B", label: "Package B", desc: "เล่น 2 ชม.", cost: REDEEM_COST },
];

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

  // Dice transfer
  const [transferCode, setTransferCode] = useState("");
  const [transferAmount, setTransferAmount] = useState(1);
  const [transferring, setTransferring] = useState(false);
  const [transferMsg, setTransferMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Dice redeem flow
  const [drinks, setDrinks] = useState<MenuItemType[]>([]);
  type RedeemStep = "confirm" | "pickDrink" | "drinkDetail";
  const [redeemFlow, setRedeemFlow] = useState<{ pkg: "A" | "B"; step: RedeemStep } | null>(null);
  const [pickedDrink, setPickedDrink] = useState<MenuItemType | null>(null);
  const [drinkSize, setDrinkSize] = useState<"S" | "XL">("S");
  const [drinkAddons, setDrinkAddons] = useState<CartSelectedAddon[]>([]);
  const [drinkOptions, setDrinkOptions] = useState<CartSelectedOption[]>([]);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
      fetch("/api/menu").then(r => r.json()).then((data: MenuItemType[]) => {
        if (Array.isArray(data)) setDrinks(data.filter(i => DRINK_CATS.includes(i.category) && i.isAvailable));
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
      if (!res.ok) { setTransferMsg({ ok: false, text: data.error ?? "เกิดข้อผิดพลาด" }); }
      else {
        setTransferMsg({ ok: true, text: `โอน ${transferAmount} 🎲 ให้ ${data.recipientName} เรียบร้อย!` });
        setTransferCode(""); setTransferAmount(1);
        setProfile(prev => prev ? { ...prev, dicePoints: prev.dicePoints - transferAmount } : prev);
      }
    } finally { setTransferring(false); }
  }

  function openRedeem(pkg: "A" | "B") {
    setRedeemMsg(null);
    if (pkg === "A") {
      setPickedDrink(null); setDrinkSize("S"); setDrinkAddons([]); setDrinkOptions([]);
      setRedeemFlow({ pkg, step: "pickDrink" });
    } else {
      setRedeemFlow({ pkg, step: "confirm" });
    }
  }

  function selectDrink(item: MenuItemType) {
    const hasSizes = item.priceS != null || item.priceXL != null;
    setPickedDrink(item);
    setDrinkSize("S");
    setDrinkAddons([]);
    setDrinkOptions(() => {
      const defs: CartSelectedOption[] = [];
      for (const og of item.optionGroups) {
        const def = og.choices.find(c => c.isDefault && c.isActive);
        if (def) defs.push({ groupId: og.id, groupName: og.nameTh, choiceId: def.id, choiceName: def.nameTh, priceTHB: def.priceTHB });
      }
      return defs;
    });
    void hasSizes;
    setRedeemFlow(prev => prev ? { ...prev, step: "drinkDetail" } : prev);
  }

  async function confirmRedeem() {
    if (!redeemFlow) return;
    setRedeeming(true);
    try {
      let body: Record<string, unknown> = { packageType: redeemFlow.pkg };
      if (redeemFlow.pkg === "A" && pickedDrink) {
        const hasSizes = pickedDrink.priceS != null || pickedDrink.priceXL != null;
        const sizeLabel = hasSizes ? ` (${drinkSize})` : "";
        const extras = [...drinkAddons.map(a => a.nameTh), ...drinkOptions.map(o => o.choiceName)].filter(Boolean).join(", ");
        const fullName = `${pickedDrink.nameTh}${sizeLabel}${extras ? ` + ${extras}` : ""}`;
        body = {
          packageType: "A",
          drinkMenuItemId: pickedDrink.id,
          drinkName: fullName,
          drinkUnitPrice: 0,
          drinkSize: hasSizes ? drinkSize : null,
          drinkAddons: drinkAddons.length ? JSON.stringify(drinkAddons) : null,
          drinkOptions: drinkOptions.length ? JSON.stringify(drinkOptions) : null,
        };
      }
      const res = await fetch("/api/dice/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setRedeemMsg({ ok: false, text: data.error ?? "เกิดข้อผิดพลาด" }); }
      else {
        const timeMsg = data.timeAdded > 0 ? ` เพิ่มเวลา ${data.timeAdded / 3600} ชม. แล้ว` : " (พนักงานจะเปิด session ให้)";
        setRedeemMsg({ ok: true, text: `แลก ${data.label} สำเร็จ!${timeMsg} แสดงหน้านี้ให้พนักงาน` });
        setProfile(prev => prev ? { ...prev, dicePoints: prev.dicePoints - REDEEM_COST } : prev);
      }
      setRedeemFlow(null);
    } finally { setRedeeming(false); }
  }

  function openNotif() {
    setNotifOpen(true);
    if (unreadCount > 0) {
      fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    }
  }

  // Drink detail computed values
  const hasSizes = pickedDrink ? (pickedDrink.priceS != null || pickedDrink.priceXL != null) : false;
  let drinkBasePrice = pickedDrink?.priceTHB ?? 0;
  if (hasSizes && drinkSize === "S" && pickedDrink?.priceS != null) drinkBasePrice = pickedDrink.priceS;
  if (hasSizes && drinkSize === "XL" && pickedDrink?.priceXL != null) drinkBasePrice = pickedDrink.priceXL;
  const drinkTotal = drinkBasePrice + drinkAddons.reduce((s, a) => s + a.priceTHB, 0) + drinkOptions.reduce((s, o) => s + o.priceTHB, 0);

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
            {/* Inbox bell */}
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
          <Link href="/profile" className="block bg-navy rounded-2xl p-5 text-center">
            <p className="text-cream/60 text-xs mb-1">รหัสสมาชิก</p>
            <p className="text-4xl font-bold text-orange tracking-[0.2em]">{profile.memberCode}</p>
            <p className="text-cream/40 text-xs mt-1">แสดงให้พนักงานเพื่อสะสมแต้ม</p>
          </Link>

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

            <div className="space-y-2">
              <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">แลกรางวัล</p>
              <div className="grid grid-cols-2 gap-2">
                {REDEEM_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => openRedeem(opt.key as "A" | "B")}
                    disabled={profile.dicePoints < opt.cost || redeeming}
                    className="bg-white/15 hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl p-3 text-left transition-all"
                  >
                    <p className="font-bold text-white text-sm">{opt.label}</p>
                    <p className="text-white/60 text-xs mt-0.5 leading-tight">{opt.desc}</p>
                    <p className="text-white font-bold text-xs mt-1.5">🎲 {opt.cost} ลูก</p>
                  </button>
                ))}
              </div>
              {redeemMsg && (
                <div className={`rounded-xl p-2.5 text-sm text-center ${redeemMsg.ok ? "bg-green-500/20 text-white" : "bg-red-500/20 text-white"}`}>
                  {redeemMsg.text}
                </div>
              )}
            </div>
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

          {/* Alerts */}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3 text-center">บันทึกข้อมูลเรียบร้อยแล้ว</div>}
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 text-center">{error}</div>}

          {/* Personal info */}
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

      {/* ===== Inbox Modal ===== */}
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

      {/* ===== Redeem: Pick Drink Modal ===== */}
      {redeemFlow?.step === "pickDrink" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setRedeemFlow(null)}>
          <div className="bg-white rounded-3xl w-full max-w-sm max-h-[80vh] overflow-y-auto shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy text-lg">เลือกเครื่องดื่ม</h3>
              <button onClick={() => setRedeemFlow(null)} className="text-gray-400 text-sm">ยกเลิก</button>
            </div>
            <p className="text-xs text-gray-400 -mt-2">Package A — น้ำฟรี 1 แก้ว + เล่น 1 ชม.</p>
            <div className="grid grid-cols-2 gap-2">
              {drinks.map(d => {
                const hasSz = d.priceS != null || d.priceXL != null;
                return (
                  <button key={d.id} onClick={() => selectDrink(d)} className="text-left bg-sand/30 hover:bg-orange/10 border border-sand hover:border-orange rounded-xl p-3 transition-all">
                    <p className="font-semibold text-navy text-sm leading-tight">{d.nameTh}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{d.nameEn}</p>
                    <p className="text-orange font-bold text-xs mt-1">{hasSz ? `S ฿${d.priceS} / XL ฿${d.priceXL}` : `฿${d.priceTHB}`}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== Redeem: Drink Detail Modal ===== */}
      {redeemFlow?.step === "drinkDetail" && pickedDrink && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setRedeemFlow(prev => prev ? { ...prev, step: "pickDrink" } : null)}>
          <div className="bg-white rounded-3xl w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-navy text-lg">{pickedDrink.nameTh}</h3>
              <button onClick={() => setRedeemFlow(prev => prev ? { ...prev, step: "pickDrink" } : null)} className="text-gray-400 text-sm">← กลับ</button>
            </div>

            {hasSizes && (
              <div>
                <p className="text-sm font-semibold text-navy mb-2">เลือกขนาด</p>
                <div className="flex gap-3">
                  {pickedDrink.priceS != null && <button onClick={() => setDrinkSize("S")} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${drinkSize === "S" ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"}`}>S — ฿{pickedDrink.priceS}</button>}
                  {pickedDrink.priceXL != null && <button onClick={() => setDrinkSize("XL")} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${drinkSize === "XL" ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"}`}>XL — ฿{pickedDrink.priceXL}</button>}
                </div>
              </div>
            )}

            {pickedDrink.addonGroups.map(group => (
              <div key={group.id}>
                <p className="text-sm font-semibold text-navy mb-2">{group.nameTh}</p>
                <div className="space-y-2">
                  {group.items.filter(i => i.isActive).map(ai => {
                    const sel = drinkAddons.some(a => a.id === ai.id);
                    return (
                      <button key={ai.id} onClick={() => setDrinkAddons(prev => sel ? prev.filter(a => a.id !== ai.id) : [...prev, { id: ai.id, groupId: group.id, nameTh: ai.nameTh, priceTHB: ai.priceTHB }])}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${sel ? "border-orange bg-orange/10" : "border-sand"}`}>
                        <span className={`text-sm font-medium ${sel ? "text-orange" : "text-navy"}`}>{sel && "✓ "}{ai.nameTh}</span>
                        <span className="text-sm text-gray-500">+฿{ai.priceTHB}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {pickedDrink.optionGroups.map(group => {
              const sel = drinkOptions.find(o => o.groupId === group.id);
              return (
                <div key={group.id}>
                  <p className="text-sm font-semibold text-navy mb-2">{group.nameTh}{group.isRequired && <span className="text-xs text-orange font-normal ml-1">*บังคับ</span>}</p>
                  <div className="space-y-2">
                    {!group.isRequired && (
                      <button onClick={() => setDrinkOptions(prev => prev.filter(o => o.groupId !== group.id))} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${!sel ? "border-orange bg-orange/10" : "border-sand"}`}>
                        <span className={`text-sm font-medium ${!sel ? "text-orange" : "text-navy"}`}>{!sel && "✓ "}ไม่ระบุ</span>
                        <span className="text-sm text-gray-400">ฟรี</span>
                      </button>
                    )}
                    {group.choices.filter(c => c.isActive).map(choice => {
                      const isSel = sel?.choiceId === choice.id;
                      return (
                        <button key={choice.id} onClick={() => setDrinkOptions(prev => [...prev.filter(o => o.groupId !== group.id), { groupId: group.id, groupName: group.nameTh, choiceId: choice.id, choiceName: choice.nameTh, priceTHB: choice.priceTHB }])}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${isSel ? "border-orange bg-orange/10" : "border-sand"}`}>
                          <span className={`text-sm font-medium ${isSel ? "text-orange" : "text-navy"}`}>{isSel && "✓ "}{choice.nameTh}</span>
                          <span className="text-sm text-gray-500">{choice.priceTHB > 0 ? `+฿${choice.priceTHB}` : "ฟรี"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between pt-3 border-t border-sand">
              <span className="text-sm text-gray-500">ราคาปกติ</span>
              <span className="font-bold text-navy line-through text-base">฿{drinkTotal}</span>
            </div>
            <p className="text-center text-sm text-orange font-semibold -mt-2">ฟรี! (แลกด้วย {REDEEM_COST} 🎲)</p>

            <button onClick={() => setRedeemFlow(prev => prev ? { ...prev, step: "confirm" } : null)} className="w-full bg-orange text-white font-bold py-3 rounded-2xl text-sm">
              เลือกเครื่องดื่มนี้ →
            </button>
          </div>
        </div>
      )}

      {/* ===== Redeem: Confirm Modal ===== */}
      {redeemFlow?.step === "confirm" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setRedeemFlow(null)}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <p className="text-4xl mb-2">🎲</p>
              <h3 className="font-bold text-navy text-lg">ยืนยันการแลกรางวัล</h3>
            </div>
            <div className="bg-sand/40 rounded-2xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">รางวัล</span>
                <span className="font-semibold text-navy">{REDEEM_OPTIONS.find(o => o.key === redeemFlow.pkg)?.label}</span>
              </div>
              {redeemFlow.pkg === "A" && pickedDrink && (
                <div className="flex justify-between">
                  <span className="text-gray-500">เครื่องดื่ม</span>
                  <span className="font-semibold text-navy text-right max-w-[60%]">
                    {(() => {
                      const sizeLabel = hasSizes ? ` (${drinkSize})` : "";
                      const extras = [...drinkAddons.map(a => a.nameTh), ...drinkOptions.map(o => o.choiceName)].filter(Boolean).join(", ");
                      return `${pickedDrink.nameTh}${sizeLabel}${extras ? ` + ${extras}` : ""}`;
                    })()}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-sand pt-2">
                <span className="text-gray-500">ใช้แต้ม</span>
                <span className="font-bold text-orange">{REDEEM_COST} 🎲</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">คงเหลือหลังแลก</span>
                <span className="font-bold text-navy">{profile.dicePoints - REDEEM_COST} 🎲</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">หลังยืนยัน ออเดอร์จะส่งไปที่พนักงานทันที</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setRedeemFlow(null)} className="py-3 rounded-xl border-2 border-sand text-navy font-semibold text-sm">ยกเลิก</button>
              <button onClick={confirmRedeem} disabled={redeeming} className="py-3 rounded-xl bg-orange text-white font-bold text-sm disabled:opacity-50">
                {redeeming ? "กำลังแลก..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
