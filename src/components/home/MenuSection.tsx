"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type MenuItem = {
  id: number;
  nameTh: string;
  nameEn: string;
  category: string;
  priceTHB: number;
  priceS: number | null;
  priceXL: number | null;
  imageUrl: string | null;
  isFeatured: boolean;
};

const CATEGORY_ICON: Record<string, string> = {
  milktea: "🧋", coffee: "☕", soda: "🥤",
  drink: "🧃", food: "🍜", snack: "🍿", dessert: "🍮",
};

export default function MenuSection() {
  const [items, setItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    fetch("/api/menu?featured=1")
      .then((r) => r.json())
      .then((data: MenuItem[]) => setItems(data))
      .catch(() => {});
  }, []);

  const displayPrice = (item: MenuItem) => {
    if (item.priceS) return `฿${item.priceS}`;
    if (item.priceTHB) return `฿${item.priceTHB}`;
    return "";
  };

  return (
    <section className="py-16 px-4 bg-cream">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-orange font-semibold text-sm uppercase tracking-wider mb-2">เมนูแนะนำ</p>
          <Link href="/menu" className="group inline-block">
            <h2 className="text-2xl md:text-3xl font-bold text-navy group-hover:text-orange transition-colors">
              อาหาร &amp; เครื่องดื่ม →
            </h2>
          </Link>
        </div>

        {/* Promo banner */}
        <div className="relative overflow-hidden bg-orange rounded-2xl p-5 mb-8 text-white">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <p className="font-bold text-lg relative">🎉 โปรโมชั่นพิเศษ!</p>
          <p className="text-white/80 text-sm relative">สั่งครบ ฿300 รับเครื่องดื่มฟรี 1 แก้ว (ทุกวัน 15:00 – 17:00)</p>
        </div>

        {/* Featured items */}
        {items.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
            {items.map((item) => (
              <Link
                key={item.id}
                href="/menu"
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
              >
                {item.imageUrl ? (
                  <div className="relative aspect-square w-full overflow-hidden">
                    <Image src={item.imageUrl} alt={item.nameTh} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : (
                  <div className="aspect-square flex items-center justify-center bg-sand group-hover:bg-sand/80 transition-colors">
                    <span className="text-4xl group-hover:scale-110 transition-transform duration-200 inline-block">{CATEGORY_ICON[item.category] ?? "🍽️"}</span>
                  </div>
                )}
                <div className="p-3 text-center">
                  <p className="font-semibold text-navy text-sm leading-tight mb-1 line-clamp-2">{item.nameTh}</p>
                  <p className="text-orange font-bold text-sm">{displayPrice(item)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
                <div className="aspect-square bg-sand" />
                <div className="p-3 space-y-1.5">
                  <div className="h-3 bg-sand rounded w-3/4 mx-auto" />
                  <div className="h-3 bg-sand rounded w-1/2 mx-auto" />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-center">
          <Link
            href="/menu"
            className="bg-navy text-cream font-bold px-6 py-3 rounded-xl text-sm hover:bg-navy/90 transition-colors"
          >
            ดูเมนูทั้งหมด →
          </Link>
        </div>
      </div>
    </section>
  );
}
