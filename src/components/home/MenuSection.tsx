"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MenuItem = {
  id: number;
  nameTh: string;
  nameEn: string;
  category: string;
  priceTHB: number;
};

const CATEGORY_ICON: Record<string, string> = {
  food: "🍜",
  drink: "🧋",
  snack: "🍿",
  dessert: "🍮",
};

export default function MenuSection() {
  const [items, setItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then((data) => {
        const featured = [
          ...data.filter((i: MenuItem) => i.category === "food").slice(0, 2),
          ...data.filter((i: MenuItem) => i.category === "drink").slice(0, 2),
          ...data.filter((i: MenuItem) => i.category === "snack").slice(0, 1),
        ];
        setItems(featured);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="py-16 px-4 bg-cream">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-orange font-semibold text-sm uppercase tracking-wider mb-2">เมนูแนะนำ</p>
          <h2 className="text-2xl md:text-3xl font-bold text-navy">อาหาร &amp; เครื่องดื่ม</h2>
        </div>

        {/* Promo banner */}
        <div className="bg-orange rounded-2xl p-5 mb-8 text-white">
          <p className="font-bold text-lg">🎉 โปรโมชั่นพิเศษ!</p>
          <p className="text-white/80 text-sm">สั่งครบ ฿300 รับเครื่องดื่มฟรี 1 แก้ว (ทุกวัน 15:00 – 17:00)</p>
        </div>

        {/* Featured items */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {items.length > 0
            ? items.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm text-center">
                  <div className="text-3xl mb-2">{CATEGORY_ICON[item.category] ?? "🍽️"}</div>
                  <p className="font-semibold text-navy text-sm leading-tight mb-1">{item.nameTh}</p>
                  <p className="text-orange font-bold text-sm">฿{item.priceTHB}</p>
                </div>
              ))
            : Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-sm text-center animate-pulse">
                  <div className="w-8 h-8 bg-sand rounded-full mx-auto mb-2" />
                  <div className="h-3 bg-sand rounded w-3/4 mx-auto mb-2" />
                  <div className="h-3 bg-sand rounded w-1/2 mx-auto" />
                </div>
              ))}
        </div>

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
