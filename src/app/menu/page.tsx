"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import CartDrawer from "@/components/orders/CartDrawer";
import { useSession } from "next-auth/react";

const DEFAULT_CATEGORIES = [
  { id: "milktea", label: "Milk & Tea", icon: "🧋", isActive: true, staffOnly: false },
  { id: "coffee", label: "Coffee", icon: "☕", isActive: true, staffOnly: false },
  { id: "soda", label: "Soda Zaa", icon: "🥤", isActive: true, staffOnly: false },
  { id: "drink", label: "เครื่องดื่ม", icon: "🧊", isActive: true, staffOnly: false },
  { id: "food", label: "อาหารจานเดียว", icon: "🍜", isActive: true, staffOnly: false },
  { id: "snack", label: "ของทานเล่น", icon: "🍿", isActive: true, staffOnly: false },
  { id: "dessert", label: "ของหวาน", icon: "🍮", isActive: true, staffOnly: false },
];

function parseSavedCategories(saved: string | undefined) {
  try {
    const custom: { id: string; label: string; icon: string; isActive: boolean; staffOnly?: boolean }[] =
      saved ? JSON.parse(saved) : [];
    const merged = DEFAULT_CATEGORIES.map((b) => {
      const found = custom.find((c) => c.id === b.id);
      return found ? { ...b, isActive: found.isActive, staffOnly: found.staffOnly ?? false } : b;
    });
    custom
      .filter((c) => !DEFAULT_CATEGORIES.find((b) => b.id === c.id) && c.isActive && !c.staffOnly)
      .forEach((c) => merged.push({ ...c, staffOnly: c.staffOnly ?? false }));
    return merged.filter((c) => c.isActive && !c.staffOnly);
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

const GAME_PACKAGES = [
  { title: "2 ชั่วโมง", price: "49", desc: "จ่าย 1 ได้อีก 1 *ไม่รวมเครื่องดื่ม", tag: "ยอดนิยม", tagColor: "bg-orange text-white", gradient: "from-orange/10 to-amber-50", border: "border-orange/30" },
  { title: "ซื้อเครื่องดื่ม 1 แก้ว", price: "0", desc: "เฉพาะเครื่องดื่มที่ร่วมรายการเท่านั้น", tag: "ฟรี 1 ชั่วโมง!", tagColor: "bg-green-500 text-white", gradient: "from-green-50 to-emerald-50", border: "border-green-300" },
  { title: "เล่นทั้งวัน + น้ำ size xl ฟรี", price: "120", desc: "เฉพาะเครื่องดื่มที่ร่วมรายการเท่านั้น", tag: "เหมาวัน", tagColor: "bg-purple-500 text-white", gradient: "from-purple-50 to-indigo-50", border: "border-purple-300" },
];

export default function MenuPage() {
  const { status } = useSession();
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [showMemberPrompt, setShowMemberPrompt] = useState(false);

  useEffect(() => {
    if (status !== "unauthenticated") return;
    if (sessionStorage.getItem("member_prompt_seen")) return;
    const t = setTimeout(() => {
      setShowMemberPrompt(true);
      sessionStorage.setItem("member_prompt_seen", "1");
    }, 1500);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    fetch("/api/site-settings")
      .then((r) => r.json())
      .then((s) => setCategories(parseSavedCategories(s?.menu_categories)))
      .catch(() => {});
  }, []);

  return (
    <>
      <Navbar />

      {showMemberPrompt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-navy px-6 pt-7 pb-5 text-center">
              <div className="text-5xl mb-3">🎲</div>
              <h2 className="text-xl font-bold text-cream leading-tight">สมัครสมาชิกวันนี้</h2>
              <p className="text-cream/70 text-sm mt-1">เพื่อเก็บลูกเต๋าและรับสิทธิประโยชน์</p>
            </div>
            <div className="px-6 py-5 space-y-3">
              {[
                { icon: "🎲", text: "สะสมลูกเต๋าทุกการสั่งอาหาร" },
                { icon: "🎁", text: "แลกรางวัลและของรางวัลพิเศษ" },
                { icon: "⭐", text: "รับสิทธิประโยชน์อื่นๆ อีกมากมาย" },
              ].map((b) => (
                <div key={b.text} className="flex items-center gap-3">
                  <span className="text-xl shrink-0">{b.icon}</span>
                  <span className="text-sm text-navy font-medium">{b.text}</span>
                </div>
              ))}
              <Link href="/register" onClick={() => setShowMemberPrompt(false)} className="block w-full bg-orange text-white font-bold py-3.5 rounded-2xl text-center text-sm mt-2">
                สมัครสมาชิกฟรี →
              </Link>
              <Link href="/login" onClick={() => setShowMemberPrompt(false)} className="block w-full text-center text-sm text-gray-400 py-1">
                มีบัญชีแล้ว? เข้าสู่ระบบ
              </Link>
              <button onClick={() => setShowMemberPrompt(false)} className="block w-full text-center text-xs text-gray-300 pb-1">
                ข้ามไปก่อน
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pt-16 min-h-screen bg-cream pb-28">
        <div className="bg-navy px-4 py-10 text-center">
          <h1 className="text-2xl font-bold text-cream mb-1">เมนูทั้งหมด</h1>
          <p className="text-cream/60 text-sm">เลือกหมวดหมู่ที่ต้องการ</p>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
          {/* Game Packages */}
          <section>
            <h2 className="text-xl font-bold text-navy mb-4 flex items-center gap-2">🎲 ค่าชั่วโมงเกม</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {GAME_PACKAGES.map((pkg) => (
                <div key={pkg.title} className={`bg-gradient-to-br ${pkg.gradient} border-2 ${pkg.border} rounded-2xl p-4`}>
                  <div className="mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pkg.tagColor}`}>{pkg.tag}</span>
                  </div>
                  <p className="font-bold text-navy text-sm leading-tight">{pkg.title}</p>
                  <p className="text-orange font-bold text-lg mt-0.5">{pkg.price === "0" ? "ฟรี" : `฿${pkg.price}`}</p>
                  <p className="text-gray-500 text-xs mt-1.5 leading-snug">{pkg.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">* ประเภทเครื่องดื่มที่ร่วมรายการ: Coffee · Milk &amp; Tea · Soda Zaa</p>
            <p className="text-sm font-bold text-center mt-2">* หากต้องการต่อเวลาโปรดเรียกพนักงานได้เลยค่ะ</p>
          </section>

          {/* Category Grid */}
          <section>
            <h2 className="text-xl font-bold text-navy mb-4">🍽️ เลือกหมวดหมู่</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/menu/${cat.id}`}
                  className="bg-white rounded-2xl shadow-sm p-5 flex flex-col items-center gap-2 hover:shadow-md hover:border-orange border-2 border-transparent transition-all text-center group"
                >
                  <span className="text-4xl group-hover:scale-110 transition-transform">{cat.icon}</span>
                  <span className="font-bold text-navy text-sm">{cat.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <Footer />
      </div>

      <CartDrawer />
    </>
  );
}
