"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import CartDrawer from "@/components/orders/CartDrawer";
import { useOrderStore, makeCartKey } from "@/store/orderStore";
import type { MenuItemType, CartSelectedAddon, CartSelectedOption } from "@/types";
import { useSession } from "next-auth/react";

function getBangkokHHMM(): string {
  const now = new Date();
  const bkk = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60_000);
  return `${String(bkk.getHours()).padStart(2, "0")}:${String(bkk.getMinutes()).padStart(2, "0")}`;
}

function isWithinSellHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return true;
  const now = getBangkokHHMM();
  return now >= start && now <= end;
}

const DEFAULT_CATEGORIES = [
  { id: "milktea", label: "Milk & Tea", icon: "🧋", isActive: true },
  { id: "coffee", label: "Coffee", icon: "☕", isActive: true },
  { id: "soda", label: "Soda Zaa", icon: "🥤", isActive: true },
  { id: "drink", label: "เครื่องดื่ม", icon: "🧊", isActive: true },
  { id: "food", label: "อาหารจานเดียว", icon: "🍜", isActive: true },
  { id: "snack", label: "ของทานเล่น", icon: "🍿", isActive: true },
  { id: "dessert", label: "ของหวาน", icon: "🍮", isActive: true },
];

function parseSavedCategories(saved: string | undefined) {
  try {
    const custom: { id: string; label: string; icon: string; isActive: boolean; staffOnly?: boolean }[] = saved ? JSON.parse(saved) : [];
    const merged = DEFAULT_CATEGORIES.map((b) => {
      const found = custom.find((c) => c.id === b.id);
      return found ? { ...b, isActive: found.isActive, staffOnly: found.staffOnly ?? false } : { ...b, staffOnly: false };
    });
    custom
      .filter((c) => !DEFAULT_CATEGORIES.find((b) => b.id === c.id) && c.isActive && !c.staffOnly)
      .forEach((c) => merged.push({ ...c, staffOnly: c.staffOnly ?? false }));
    return merged.filter((c) => !c.staffOnly);
  } catch { return DEFAULT_CATEGORIES; }
}


const GAME_PACKAGES = [
  {
    title: "2 ชั่วโมง",
    price: "49",
    desc: "จ่าย 1 ได้อีก 1 *ไม่รวมเครื่องดื่ม",
    tag: "ยอดนิยม",
    tagColor: "bg-orange text-white",
    gradient: "from-orange/10 to-amber-50",
    border: "border-orange/30",
  },
  {

    title: "ซื้อเครื่องดื่ม 1 แก้ว",
    price: "0",
    desc: "เฉพาะเครื่องดื่มที่ร่วมรายการเท่านั้น",
    tag: "ฟรี 1 ชั่วโมง!",
    tagColor: "bg-green-500 text-white",
    gradient: "from-green-50 to-emerald-50",
    border: "border-green-300",
  },
  {

    title: "เล่นทั้งวัน + น้ำ size xl ฟรี",
    price: "120",
    desc: "เฉพาะเครื่องดื่มที่ร่วมรายการเท่านั้น",
    tag: "เหมาวัน",
    tagColor: "bg-purple-500 text-white",
    gradient: "from-purple-50 to-indigo-50",
    border: "border-purple-300",
  },
];

export default function MenuPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<MenuItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [CATEGORIES, setCATEGORIES] = useState(DEFAULT_CATEGORIES);
  const [pickerItem, setPickerItem] = useState<MenuItemType | null>(null);
  const [pickerSize, setPickerSize] = useState<"S" | "XL">("S");
  const [pickerAddons, setPickerAddons] = useState<CartSelectedAddon[]>([]);
  const [pickerOptions, setPickerOptions] = useState<CartSelectedOption[]>([]);
  const { addItem } = useOrderStore();
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
    Promise.all([
      fetch("/api/menu").then((r) => r.json()),
      fetch("/api/site-settings").then((r) => r.json()).catch(() => ({})),
    ]).then(([menuData, settings]) => {
      setItems(menuData);
      setCATEGORIES(parseSavedCategories(settings?.menu_categories));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const activeCatIds = new Set(CATEGORIES.filter((c) => c.isActive).map((c) => c.id));
  const availableItems = items.filter((i) => i.isAvailable && i.category !== "gametime" && activeCatIds.has(i.category));

  function openPicker(item: MenuItemType) {
    setPickerItem(item);
    setPickerSize("S");
    setPickerAddons([]);
    const defaults: CartSelectedOption[] = [];
    for (const og of item.optionGroups) {
      const defaultChoice = og.choices.find((c) => c.isDefault && c.isActive);
      if (defaultChoice) {
        defaults.push({
          groupId: og.id,
          groupName: og.nameTh,
          choiceId: defaultChoice.id,
          choiceName: defaultChoice.nameTh,
          priceTHB: defaultChoice.priceTHB,
        });
      }
    }
    setPickerOptions(defaults);
  }

  function closePicker() {
    setPickerItem(null);
    setPickerAddons([]);
    setPickerOptions([]);
  }

  function confirmPicker() {
    if (!pickerItem) return;
    if (!isWithinSellHours(pickerItem.sellStartTime, pickerItem.sellEndTime)) {
      alert(`ไม่สามารถสั่งได้ตอนนี้ — รับออเดอร์ ${pickerItem.sellStartTime}–${pickerItem.sellEndTime} น. เท่านั้น`);
      closePicker();
      return;
    }
    for (const og of pickerItem.optionGroups) {
      if (og.isRequired && !pickerOptions.find((o) => o.groupId === og.id)) {
        alert(`กรุณาเลือก ${og.nameTh}`);
        return;
      }
    }
    const hasSizes = pickerItem.priceS != null || pickerItem.priceXL != null;
    const size = hasSizes ? pickerSize : null;
    let basePrice = pickerItem.priceTHB;
    if (size === "S" && pickerItem.priceS != null) basePrice = pickerItem.priceS;
    if (size === "XL" && pickerItem.priceXL != null) basePrice = pickerItem.priceXL;
    const addonTotal = pickerAddons.reduce((s, a) => s + a.priceTHB, 0);
    const optionTotal = pickerOptions.reduce((s, o) => s + o.priceTHB, 0);
    addItem({
      cartKey: makeCartKey(pickerItem.id, size, pickerAddons, pickerOptions),
      menuItemId: pickerItem.id,
      nameTh: pickerItem.nameTh,
      priceTHB: basePrice + addonTotal + optionTotal,
      selectedSize: size,
      selectedAddons: pickerAddons,
      selectedOptions: pickerOptions,
    });
    closePicker();
  }

  function handleAddDirect(item: MenuItemType) {
    const hasSizes = item.priceS != null || item.priceXL != null;
    const hasGroups = item.addonGroups.length > 0 || item.optionGroups.length > 0;
    if (hasSizes || hasGroups) {
      openPicker(item);
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

  function toggleAddonItem(groupId: number, itemId: number, itemName: string, price: number) {
    setPickerAddons((prev) => {
      const existing = prev.find((a) => a.id === itemId);
      if (existing) return prev.filter((a) => a.id !== itemId);
      return [...prev, { id: itemId, groupId, nameTh: itemName, priceTHB: price }];
    });
  }

  function selectOption(groupId: number, groupName: string, choiceId: number, choiceName: string, price: number) {
    setPickerOptions((prev) => {
      const filtered = prev.filter((o) => o.groupId !== groupId);
      if (choiceId === -1) return filtered;
      return [...filtered, { groupId, groupName, choiceId, choiceName, priceTHB: price }];
    });
  }

  const pickerHasSizes = pickerItem && (pickerItem.priceS != null || pickerItem.priceXL != null);
  const pickerBasePrice = pickerItem
    ? pickerHasSizes
      ? pickerSize === "S"
        ? (pickerItem.priceS ?? pickerItem.priceTHB)
        : (pickerItem.priceXL ?? pickerItem.priceTHB)
      : pickerItem.priceTHB
    : 0;
  const pickerTotal =
    pickerBasePrice +
    pickerAddons.reduce((s, a) => s + a.priceTHB, 0) +
    pickerOptions.reduce((s, o) => s + o.priceTHB, 0);

  return (
    <>
      <Navbar />

      {/* Member sign-up prompt for guests */}
      {showMemberPrompt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease-out]">
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
              <Link
                href="/register"
                onClick={() => setShowMemberPrompt(false)}
                className="block w-full bg-orange text-white font-bold py-3.5 rounded-2xl text-center text-sm mt-2"
              >
                สมัครสมาชิกฟรี →
              </Link>
              <Link
                href="/login"
                onClick={() => setShowMemberPrompt(false)}
                className="block w-full text-center text-sm text-gray-400 py-1"
              >
                มีบัญชีแล้ว? เข้าสู่ระบบ
              </Link>
              <button
                onClick={() => setShowMemberPrompt(false)}
                className="block w-full text-center text-xs text-gray-300 pb-1"
              >
                ข้ามไปก่อน
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pt-16 min-h-screen bg-cream pb-28">
        <div className="bg-navy px-4 py-10 text-center">
          <h1 className="text-2xl font-bold text-cream mb-1">เมนูทั้งหมด</h1>
          <p className="text-cream/60 text-sm">เลือกรายการแล้วเพิ่มลงตะกร้าได้เลย</p>
        </div>

        <div className="sticky top-16 z-10 bg-cream border-b border-sand flex overflow-x-auto no-scrollbar">
          {CATEGORIES.filter(
            (cat) => cat.isActive && (loading || availableItems.some((i) => i.category === cat.id))
          ).map((cat) => (
            <a
              key={cat.id}
              href={`#${cat.id}`}
              className="shrink-0 px-5 py-3 text-sm font-semibold text-navy hover:text-orange transition-colors border-b-2 border-transparent hover:border-orange"
            >
              {cat.icon} {cat.label}
            </a>
          ))}
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
          {/* Game Time Packages */}
          <section id="gametime">
            <h2 className="text-xl font-bold text-navy mb-4 flex items-center gap-2">
              🎲 ค่าชั่วโมงเกม
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {GAME_PACKAGES.map((pkg) => (
                <div
                  key={pkg.title}
                  className={`bg-gradient-to-br ${pkg.gradient} border-2 ${pkg.border} rounded-2xl p-5`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pkg.tagColor}`}>{pkg.tag}</span>
                  </div>
                  <p className="font-bold text-navy text-lg leading-tight">{pkg.title}</p>
                  <p className="text-orange font-bold text-2xl mt-0.5">
                    {pkg.price === "0" ? "ฟรี" : `฿${pkg.price}`}
                  </p>
                  <p className="text-gray-500 text-xs mt-2 leading-snug">{pkg.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-5 text-center">
              * ประเภทเครื่องดื่มที่ร่วมรายการ: Coffee · Milk &amp; Tea · Soda Zaa
            </p>
            <p className="text-xl text-Black font-bold text-center mt-3 text-center">
              * หากต้องการต่อเวลาโปรดเรียกพนักงานได้เลยค่ะ
            </p>
          </section>

          {CATEGORIES.filter((cat) => cat.isActive).map((cat) => {
            const catItems = availableItems.filter((i) => i.category === cat.id);
            if (catItems.length === 0 && !loading) return null;

            return (
              <section key={cat.id} id={cat.id}>
                <h2 className="text-xl font-bold text-navy mb-4 flex items-center gap-2">
                  <span>{cat.icon}</span> {cat.label}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {loading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl p-4 shadow-sm animate-pulse h-36" />
                      ))
                    : catItems.map((item) => {
                        const hasSizes = item.priceS != null || item.priceXL != null;
                        const canOrder = isWithinSellHours(item.sellStartTime, item.sellEndTime);
                        return (
                          <div key={item.id} className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
                            {item.imageUrl ? (
                              <div className="relative aspect-[4/3]">
                                <Image src={item.imageUrl} alt={item.nameTh} fill className="object-cover" />
                              </div>
                            ) : (
                              <div className="aspect-[4/3] bg-sand/40 flex items-center justify-center text-4xl">
                                {cat.icon}
                              </div>
                            )}
                            <div className="p-3 flex-1 flex flex-col">
                              <p className="font-bold text-navy text-sm leading-tight mb-0.5">{item.nameTh}</p>
                              <p className="text-gray-400 text-xs mb-2">{item.nameEn}</p>
                              {!canOrder && (
                                <p className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-lg mb-2">
                                  ⏰ รับออเดอร์ {item.sellStartTime}–{item.sellEndTime} น.
                                </p>
                              )}
                              <div className="flex items-center justify-between mt-auto">
                                <div>
                                  {hasSizes ? (
                                    <p className="text-orange font-bold text-xs">
                                      S ฿{item.priceS} / XL ฿{item.priceXL}
                                    </p>
                                  ) : (
                                    <p className="text-orange font-bold">฿{item.priceTHB}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => canOrder && handleAddDirect(item)}
                                  disabled={!canOrder}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${canOrder ? "bg-orange text-white hover:bg-orange/90" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
                                >
                                  + เพิ่ม
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="max-w-4xl mx-auto px-4 pb-6 text-center">
          <Link href="/" className="text-sm text-gray-400 hover:text-navy">
            ← กลับหน้าแรก
          </Link>
        </div>

        <Footer />
      </div>

      <CartDrawer />

      {pickerItem && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={closePicker} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 p-5 max-h-[85vh] overflow-y-auto md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:w-[480px] md:max-h-[85vh]">
            <h3 className="font-bold text-navy text-lg mb-1">{pickerItem.nameTh}</h3>
            <p className="text-xs text-gray-400 mb-4">{pickerItem.nameEn}</p>

            {/* Size selector */}
            {pickerHasSizes && (
              <div className="mb-5">
                <p className="text-sm font-semibold text-navy mb-2">เลือกขนาด</p>
                <div className="flex gap-3">
                  {pickerItem.priceS != null && (
                    <button
                      onClick={() => setPickerSize("S")}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                        pickerSize === "S" ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"
                      }`}
                    >
                      S — ฿{pickerItem.priceS}
                    </button>
                  )}
                  {pickerItem.priceXL != null && (
                    <button
                      onClick={() => setPickerSize("XL")}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                        pickerSize === "XL" ? "border-orange bg-orange/10 text-orange" : "border-sand text-navy"
                      }`}
                    >
                      XL — ฿{pickerItem.priceXL}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Addon Groups */}
            {pickerItem.addonGroups.map((group) => (
              <div key={group.id} className="mb-5">
                <p className="text-sm font-semibold text-navy mb-2">{group.nameTh}</p>
                <div className="space-y-2">
                  {group.items.filter((i) => i.isActive).map((addonItem) => {
                    const selected = pickerAddons.some((a) => a.id === addonItem.id);
                    return (
                      <button
                        key={addonItem.id}
                        onClick={() => toggleAddonItem(group.id, addonItem.id, addonItem.nameTh, addonItem.priceTHB)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                          selected ? "border-orange bg-orange/10" : "border-sand"
                        }`}
                      >
                        <span className={`text-sm font-medium flex items-center gap-1.5 ${selected ? "text-orange" : "text-navy"}`}>
                          {selected && <span>✓</span>}
                          {addonItem.nameTh}
                        </span>
                        <span className="text-sm text-gray-500">+฿{addonItem.priceTHB}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Option Groups */}
            {pickerItem.optionGroups.map((group) => {
              const selectedChoice = pickerOptions.find((o) => o.groupId === group.id);
              return (
                <div key={group.id} className="mb-5">
                  <p className="text-sm font-semibold text-navy mb-2 flex items-center gap-2">
                    {group.nameTh}
                    {group.isRequired && (
                      <span className="text-xs text-orange font-normal">*บังคับ</span>
                    )}
                  </p>
                  <div className="space-y-2">
                    {!group.isRequired && (
                      <button
                        onClick={() => selectOption(group.id, group.nameTh, -1, "", 0)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                          !selectedChoice ? "border-orange bg-orange/10" : "border-sand"
                        }`}
                      >
                        <span className={`text-sm font-medium ${!selectedChoice ? "text-orange" : "text-navy"}`}>
                          {!selectedChoice && "✓ "}ไม่ระบุ
                        </span>
                        <span className="text-sm text-gray-400">ฟรี</span>
                      </button>
                    )}
                    {group.choices.filter((c) => c.isActive).map((choice) => {
                      const isSelected = selectedChoice?.choiceId === choice.id;
                      return (
                        <button
                          key={choice.id}
                          onClick={() => selectOption(group.id, group.nameTh, choice.id, choice.nameTh, choice.priceTHB)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                            isSelected ? "border-orange bg-orange/10" : "border-sand"
                          }`}
                        >
                          <span className={`text-sm font-medium ${isSelected ? "text-orange" : "text-navy"}`}>
                            {isSelected && "✓ "}{choice.nameTh}
                          </span>
                          <span className="text-sm text-gray-500">
                            {choice.priceTHB > 0 ? `+฿${choice.priceTHB}` : "ฟรี"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between mb-4 pt-2 border-t border-sand">
              <span className="text-sm text-gray-500">รวม</span>
              <span className="font-bold text-orange text-lg">฿{pickerTotal}</span>
            </div>

            <button onClick={confirmPicker} className="w-full bg-orange text-white font-bold py-3 rounded-xl">
              เพิ่มลงตะกร้า
            </button>
          </div>
        </>
      )}
    </>
  );
}
