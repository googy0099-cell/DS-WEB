"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import CartDrawer from "@/components/orders/CartDrawer";
import { useOrderStore } from "@/store/orderStore";

type MenuItem = {
  id: number;
  nameTh: string;
  nameEn: string;
  category: string;
  priceTHB: number;
  imageUrl: string | null;
  isAvailable: boolean;
};

const CATEGORIES = [
  { id: "drink", label: "เครื่องดื่ม", icon: "🧋" },
  { id: "food", label: "อาหารจานเดียว", icon: "🍜" },
  { id: "snack", label: "ของทานเล่น", icon: "🍿" },
  { id: "dessert", label: "ของหวาน", icon: "🍮" },
];

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useOrderStore();

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const availableItems = items.filter((i) => i.isAvailable);

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
          {CATEGORIES.map((cat) => (
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
                    : catItems.map((item) => (
                        <div key={item.id} className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
                          {item.imageUrl ? (
                            <div className="relative aspect-[4/3]">
                              <Image
                                src={item.imageUrl}
                                alt={item.nameTh}
                                fill
                                className="object-cover"
                              />
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
                              <p className="text-orange font-bold">฿{item.priceTHB}</p>
                              <button
                                onClick={() =>
                                  addItem({
                                    menuItemId: item.id,
                                    nameTh: item.nameTh,
                                    priceTHB: item.priceTHB,
                                  })
                                }
                                className="bg-orange text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-orange/90 transition-colors"
                              >
                                + เพิ่ม
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
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
    </>
  );
}
