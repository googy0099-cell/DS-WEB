"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import CartDrawer from "@/components/orders/CartDrawer";
import { useOrderStore, makeCartKey } from "@/store/orderStore";
import type { MenuItemType, AddonType } from "@/types";

const CATEGORIES = [
  { id: "milktea", label: "Milk & Tea", icon: "🧋" },
  { id: "coffee", label: "Coffee", icon: "☕" },
  { id: "soda", label: "Soda Zaa", icon: "🥤" },
  { id: "drink", label: "เครื่องดื่ม", icon: "🧊" },
  { id: "food", label: "อาหารจานเดียว", icon: "🍜" },
  { id: "snack", label: "ของทานเล่น", icon: "🍿" },
  { id: "dessert", label: "ของหวาน", icon: "🍮" },
];

export default function MenuPage() {
  const [items, setItems] = useState<MenuItemType[]>([]);
  const [addons, setAddons] = useState<AddonType[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerItem, setPickerItem] = useState<MenuItemType | null>(null);
  const [pickerSize, setPickerSize] = useState<"S" | "XL">("S");
  const [pickerAddons, setPickerAddons] = useState<AddonType[]>([]);
  const { addItem } = useOrderStore();

  useEffect(() => {
    Promise.all([
      fetch("/api/menu").then((r) => r.json()),
      fetch("/api/addons").then((r) => r.json()),
    ])
      .then(([menuData, addonData]) => {
        setItems(menuData);
        setAddons(addonData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const availableItems = items.filter((i) => i.isAvailable);

  function openPicker(item: MenuItemType) {
    setPickerItem(item);
    setPickerSize("S");
    setPickerAddons([]);
  }

  function closePicker() {
    setPickerItem(null);
    setPickerAddons([]);
  }

  function confirmPicker() {
    if (!pickerItem) return;
    const hasSizes = pickerItem.priceS != null || pickerItem.priceXL != null;
    const size = hasSizes ? pickerSize : null;
    let basePrice = pickerItem.priceTHB;
    if (size === "S" && pickerItem.priceS) basePrice = pickerItem.priceS;
    if (size === "XL" && pickerItem.priceXL) basePrice = pickerItem.priceXL;
    const addonTotal = pickerAddons.reduce((s, a) => s + a.priceTHB, 0);
    addItem({
      cartKey: makeCartKey(pickerItem.id, size, pickerAddons),
      menuItemId: pickerItem.id,
      nameTh: pickerItem.nameTh,
      priceTHB: basePrice + addonTotal,
      selectedSize: size,
      selectedAddons: pickerAddons.map((a) => ({
        id: a.id,
        nameTh: a.nameTh,
        priceTHB: a.priceTHB,
      })),
    });
    closePicker();
  }

  function handleAddDirect(item: MenuItemType) {
    if (item.priceS != null || item.priceXL != null || addons.length > 0) {
      openPicker(item);
    } else {
      addItem({
        cartKey: makeCartKey(item.id, null, []),
        menuItemId: item.id,
        nameTh: item.nameTh,
        priceTHB: item.priceTHB,
        selectedSize: null,
        selectedAddons: [],
      });
    }
  }

  function toggleAddon(addon: AddonType) {
    setPickerAddons((prev) =>
      prev.find((a) => a.id === addon.id)
        ? prev.filter((a) => a.id !== addon.id)
        : [...prev, addon]
    );
  }

  const pickerHasSizes =
    pickerItem && (pickerItem.priceS != null || pickerItem.priceXL != null);
  const pickerBasePrice = pickerItem
    ? pickerHasSizes
      ? pickerSize === "S"
        ? pickerItem.priceS ?? pickerItem.priceTHB
        : pickerItem.priceXL ?? pickerItem.priceTHB
      : pickerItem.priceTHB
    : 0;
  const pickerTotal =
    pickerBasePrice + pickerAddons.reduce((s, a) => s + a.priceTHB, 0);

  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen bg-cream pb-28">
        <div className="bg-navy px-4 py-10 text-center">
          <h1 className="text-2xl font-bold text-cream mb-1">เมนูทั้งหมด</h1>
          <p className="text-cream/60 text-sm">เลือกรายการแล้วเพิ่มลงตะกร้าได้เลย</p>
        </div>

        {/* Category tabs */}
        <div className="sticky top-16 z-10 bg-cream border-b border-sand flex overflow-x-auto no-scrollbar">
          {CATEGORIES.filter(
            (cat) => loading || availableItems.some((i) => i.category === cat.id)
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
          {CATEGORIES.map((cat) => {
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
                                  onClick={() => handleAddDirect(item)}
                                  className="bg-orange text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-orange/90 transition-colors"
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

      {/* Size / Addon Picker */}
      {pickerItem && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={closePicker} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 p-5 max-h-[80vh] overflow-y-auto">
            <h3 className="font-bold text-navy text-lg mb-1">{pickerItem.nameTh}</h3>
            <p className="text-xs text-gray-400 mb-4">{pickerItem.nameEn}</p>

            {pickerHasSizes && (
              <div className="mb-5">
                <p className="text-sm font-semibold text-navy mb-2">เลือกขนาด</p>
                <div className="flex gap-3">
                  {pickerItem.priceS != null && (
                    <button
                      onClick={() => setPickerSize("S")}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                        pickerSize === "S"
                          ? "border-orange bg-orange/10 text-orange"
                          : "border-sand text-navy"
                      }`}
                    >
                      S — ฿{pickerItem.priceS}
                    </button>
                  )}
                  {pickerItem.priceXL != null && (
                    <button
                      onClick={() => setPickerSize("XL")}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                        pickerSize === "XL"
                          ? "border-orange bg-orange/10 text-orange"
                          : "border-sand text-navy"
                      }`}
                    >
                      XL — ฿{pickerItem.priceXL}
                    </button>
                  )}
                </div>
              </div>
            )}

            {addons.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-semibold text-navy mb-2">Add-on</p>
                <div className="space-y-2">
                  {addons.map((addon) => {
                    const selected = pickerAddons.some((a) => a.id === addon.id);
                    return (
                      <button
                        key={addon.id}
                        onClick={() => toggleAddon(addon)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                          selected
                            ? "border-orange bg-orange/10"
                            : "border-sand"
                        }`}
                      >
                        <span className={`text-sm font-medium ${selected ? "text-orange" : "text-navy"}`}>
                          {selected ? "✓ " : ""}{addon.nameTh}
                        </span>
                        <span className="text-sm text-gray-500">+฿{addon.priceTHB}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">รวม</span>
              <span className="font-bold text-orange text-lg">฿{pickerTotal}</span>
            </div>

            <button
              onClick={confirmPicker}
              className="w-full bg-orange text-white font-bold py-3 rounded-xl"
            >
              เพิ่มลงตะกร้า
            </button>
          </div>
        </>
      )}
    </>
  );
}
