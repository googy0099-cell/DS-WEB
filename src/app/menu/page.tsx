"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import CartDrawer from "@/components/orders/CartDrawer";
import MenuItemPicker from "@/components/orders/MenuItemPicker";
import { useSession } from "next-auth/react";
import { useOrderStore, makeCartKey } from "@/store/orderStore";
import { CategoryIcon } from "@/lib/categoryIcons";
import type { MenuItemType } from "@/types";

const DEFAULT_CATEGORIES = [
  { id: "milktea", label: "Milk & Tea", icon: "🧋" },
  { id: "coffee", label: "Coffee", icon: "☕" },
  { id: "soda", label: "Soda Zaa", icon: "🥤" },
  { id: "drink", label: "เครื่องดื่ม", icon: "🧊" },
  { id: "food", label: "อาหารจานเดียว", icon: "🍜" },
  { id: "snack", label: "ของทานเล่น", icon: "🍿" },
  { id: "dessert", label: "ของหวาน", icon: "🍮" },
];

const GAME_PACKAGES = [
  { title: "2 ชั่วโมง", price: "49", desc: "จ่าย 1 ได้อีก 1 *ไม่รวมเครื่องดื่ม", tag: "ยอดนิยม" },
  { title: "ซื้อเครื่องดื่ม 1 แก้ว", price: "0", desc: "เฉพาะเครื่องดื่มที่ร่วมรายการ", tag: "ฟรี 1 ชม." },
  { title: "เล่นทั้งวัน ฟรีเครื่องดื่มไซส์ XL ", price: "120", desc: "เฉพาะเครื่องดื่มที่ร่วมรายการ", tag: "เหมาวัน" },
];

function getBangkokHHMM() {
  const now = new Date();
  const bkk = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60_000);
  return `${String(bkk.getHours()).padStart(2, "0")}:${String(bkk.getMinutes()).padStart(2, "0")}`;
}

function isWithinSellHours(start: string | null, end: string | null) {
  if (!start || !end) return true;
  const now = getBangkokHHMM();
  return now >= start && now <= end;
}

function parseSavedCategories(saved: string | undefined) {
  try {
    const custom: { id: string; label: string; icon: string; isActive: boolean; staffOnly?: boolean }[] =
      saved ? JSON.parse(saved) : [];
    const merged = DEFAULT_CATEGORIES.map((b) => {
      const found = custom.find((c) => c.id === b.id);
      return found ? { ...b, label: found.label, icon: found.icon, isActive: found.isActive, staffOnly: found.staffOnly ?? false } : { ...b, isActive: true, staffOnly: false };
    });
    custom
      .filter((c) => !DEFAULT_CATEGORIES.find((b) => b.id === c.id) && c.isActive && !c.staffOnly)
      .forEach((c) => merged.push({ ...c, staffOnly: c.staffOnly ?? false }));
    return merged.filter((c) => c.isActive && !c.staffOnly);
  } catch {
    return DEFAULT_CATEGORIES.map((c) => ({ ...c, isActive: true, staffOnly: false }));
  }
}

export default function MenuPage() {
  const { status } = useSession();
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES.map((c) => ({ ...c, isActive: true, staffOnly: false })));
  const [allItems, setAllItems] = useState<MenuItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerItem, setPickerItem] = useState<MenuItemType | null>(null);
  const [showMemberPrompt, setShowMemberPrompt] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const navRef = useRef<HTMLDivElement>(null);
  const { addItem, cart } = useOrderStore();

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
    Promise.all([
      fetch("/api/menu").then((r) => r.json()),
      fetch("/api/site-settings").then((r) => r.json()).catch(() => ({})),
    ]).then(([menuData, settings]) => {
      setCategories(parseSavedCategories(settings?.menu_categories));
      setAllItems((menuData as MenuItemType[]).filter((i) => i.isAvailable));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Scrollspy: track which section is in view
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    categories.forEach(({ id }) => {
      const el = sectionRefs.current[id];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: "-30% 0px -60% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [categories, loading]);

  function scrollToSection(id: string) {
    const el = sectionRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleAdd(item: MenuItemType) {
    const hasSizes = item.priceS != null || item.priceXL != null;
    const hasGroups = item.addonGroups.length > 0 || item.optionGroups.length > 0;
    if (hasSizes || hasGroups) {
      setPickerItem(item);
    } else {
      addItem({
        cartKey: makeCartKey(item.id, null, [], []),
        menuItemId: item.id,
        nameTh: item.nameTh,
        priceTHB: item.priceTHB,
        selectedSize: null,
        selectedAddons: [],
        selectedOptions: [],
      });
    }
  }

  const itemsByCategory = Object.fromEntries(
    categories.map(({ id }) => [
      id,
      allItems.filter((item) => item.category === id && isWithinSellHours(item.sellStartTime, item.sellEndTime)),
    ])
  );
  const visibleCategories = categories.filter(({ id }) => (itemsByCategory[id]?.length ?? 0) > 0);

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

      <div className="pt-16 min-h-screen bg-cream pb-28 animate-fade-in">
        {/* Hero */}
        <div className="bg-navy px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-cream mb-1">เมนูทั้งหมด</h1>
          <p className="text-cream/60 text-sm">กดหมวดหมู่เพื่อเลื่อนไปดูได้เลย</p>
        </div>

        {/* Sticky category nav */}
        <div ref={navRef} className="sticky top-16 z-30 bg-cream/95 backdrop-blur border-b border-sand shadow-sm">
          <div className="max-w-4xl mx-auto px-3">
            <div className="flex gap-2 overflow-x-auto py-2.5 scrollbar-hide no-scrollbar">
              {visibleCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => scrollToSection(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all shrink-0 ${
                    activeSection === cat.id
                      ? "bg-navy text-cream shadow-sm"
                      : "bg-white text-navy border border-sand hover:border-navy"
                  }`}
                >
                  <CategoryIcon id={cat.id} fallback={cat.icon} size={14} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-10">
          {/* Game Packages */}
          <section>
            <h2 className="text-lg font-bold text-navy mb-3 flex items-center gap-2">🎲 ค่าชั่วโมงเกม</h2>
            <div className="grid grid-cols-3 gap-3">
              {GAME_PACKAGES.map((pkg) => (
                <div key={pkg.title} className="bg-orange/10 border-2 border-orange/30 rounded-2xl p-4 flex flex-col gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange text-white self-start">{pkg.tag}</span>
                  <p className="font-bold text-navy text-sm leading-tight">{pkg.title}</p>
                  <p className="text-orange font-bold text-2xl">{pkg.price === "0" ? "ฟรี" : `฿${pkg.price}`}</p>
                  <p className="text-gray-500 text-xs leading-snug mt-auto">{pkg.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">* เครื่องดื่มที่ร่วมรายการ: Coffee · Milk &amp; Tea · Soda Zaa</p>
            <p className="text-sm font-bold text-center mt-1">* หากต้องการต่อเวลาโปรดเรียกพนักงานได้เลยค่ะ</p>
          </section>

          {/* Menu sections by category */}
          {loading ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3 animate-pulse">🍽️</div>
              <p>กำลังโหลดเมนู...</p>
            </div>
          ) : (
            visibleCategories.map((cat) => {
              const items = itemsByCategory[cat.id] ?? [];
              return (
                <section
                  key={cat.id}
                  ref={(el) => { sectionRefs.current[cat.id] = el; }}
                  style={{ scrollMarginTop: "8rem" }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <CategoryIcon id={cat.id} fallback={cat.icon} size={22} className="text-navy/60" />
                    <h2 className="text-lg font-bold text-navy">{cat.label}</h2>
                    <span className="text-xs text-gray-400 ml-auto">{items.length} รายการ</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {items.map((item) => {
                      const inCart = cart.find((c) => c.menuItemId === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleAdd(item)}
                          className="bg-white rounded-2xl shadow-sm overflow-hidden text-left hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all group relative"
                        >
                          {item.imageUrl ? (
                            <div className="relative w-full aspect-square">
                              <Image
                                src={item.imageUrl}
                                alt={item.nameTh}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 50vw, 33vw"
                              />
                            </div>
                          ) : (
                            <div className="w-full aspect-square bg-sand/50 flex items-center justify-center">
                              <CategoryIcon id={cat.id} fallback={cat.icon} size={36} className="text-navy/20" />
                            </div>
                          )}
                          {inCart && (
                            <div className="absolute top-2 right-2 bg-orange text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                              {inCart.quantity}
                            </div>
                          )}
                          <div className="p-2.5">
                            <p className="font-semibold text-navy text-sm leading-tight line-clamp-2">{item.nameTh}</p>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-orange font-bold text-sm">
                                {(() => {
                                  const prices = [item.priceTHB, item.priceS, item.priceXL].filter((p): p is number => p != null && p > 0);
                                  const minPrice = prices.length > 0 ? Math.min(...prices) : item.priceTHB;
                                  const hasMultiple = item.priceS != null || item.priceXL != null;
                                  return <>{`฿${minPrice}`}{hasMultiple && <span className="text-gray-400 font-normal text-xs"> ขึ้นไป</span>}</>;
                                })()}
                              </p>
                              <span className="w-6 h-6 bg-orange text-white text-lg font-bold rounded-full flex items-center justify-center leading-none shrink-0">+</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>

        <Footer />
      </div>

      {pickerItem && (
        <MenuItemPicker
          item={pickerItem}
          onClose={() => setPickerItem(null)}
        />
      )}

      <CartDrawer />
    </>
  );
}
