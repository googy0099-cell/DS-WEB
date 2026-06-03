"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import { QrCode } from "lucide-react";
import type { MenuItemType } from "@/types";
import { CategoryIcon } from "@/lib/categoryIcons";

const DEFAULT_CATEGORIES = [
  { id: "milktea", label: "Milk & Tea", icon: "🧋" },
  { id: "coffee", label: "Coffee", icon: "☕" },
  { id: "soda", label: "Soda Zaa", icon: "🥤" },
  { id: "drink", label: "เครื่องดื่ม", icon: "🧊" },
  { id: "food", label: "อาหารจานเดียว", icon: "🍜" },
  { id: "snack", label: "ของทานเล่น", icon: "🍿" },
  { id: "dessert", label: "ของหวาน", icon: "🍮" },
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

export default function CategoryMenuPage() {
  const params = useParams();
  const categoryId = params.category as string;

  const [items, setItems] = useState<MenuItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [catInfo, setCatInfo] = useState<{ id: string; label: string; icon: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/menu?category=${categoryId}`).then((r) => r.json()),
      fetch("/api/site-settings").then((r) => r.json()).catch(() => ({})),
    ]).then(([menuData, settings]) => {
      const customCats: { id: string; label: string; icon: string; isActive: boolean; staffOnly?: boolean }[] =
        settings?.menu_categories ? JSON.parse(settings.menu_categories) : [];
      const allCats = [
        ...DEFAULT_CATEGORIES.map((d) => {
          const found = customCats.find((c) => c.id === d.id);
          return found ? { ...d, label: found.label, icon: found.icon } : d;
        }),
        ...customCats.filter((c) => !DEFAULT_CATEGORIES.find((d) => d.id === c.id) && c.isActive && !c.staffOnly),
      ];
      const found = allCats.find((c) => c.id === categoryId);
      setCatInfo(found ?? { id: categoryId, label: categoryId, icon: "🍽️" });
      setItems((menuData as MenuItemType[]).filter((i) => i.isAvailable));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [categoryId]);

  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen bg-cream pb-28">
        <div className="bg-navy px-4 py-8 text-center">
          <div className="flex justify-center mb-2">
            <CategoryIcon id={catInfo?.id ?? ""} fallback={catInfo?.icon ?? "🍽️"} size={52} className="text-cream/80" />
          </div>
          <h1 className="text-2xl font-bold text-cream mb-1">{catInfo?.label ?? categoryId}</h1>
          <Link href="/menu" className="text-cream/50 text-sm hover:text-cream/80 transition-colors">
            ← กลับหมวดหมู่
          </Link>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-sm animate-pulse h-48" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🍽️</p>
              <p className="font-semibold">ยังไม่มีเมนูในหมวดนี้</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {items.map((item) => {
                const hasSizes = item.priceS != null || item.priceXL != null;
                const withinHours = isWithinSellHours(item.sellStartTime, item.sellEndTime);
                return (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    {item.imageUrl ? (
                      <div className="relative aspect-[4/3]">
                        <Image src={item.imageUrl} alt={item.nameTh} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-sand/40 flex items-center justify-center">
                        <CategoryIcon id={catInfo?.id ?? ""} fallback={catInfo?.icon ?? "🍽️"} size={40} className="text-navy/30" />
                      </div>
                    )}
                    <div className="p-3 flex-1 flex flex-col">
                      <p className="font-bold text-navy text-sm leading-tight mb-0.5">{item.nameTh}</p>
                      <p className="text-gray-400 text-xs mb-2">{item.nameEn}</p>
                      {!withinHours && (
                        <p className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-lg mb-2">
                          ⏰ รับออเดอร์ {item.sellStartTime}–{item.sellEndTime} น.
                        </p>
                      )}
                      <div className="mt-auto">
                        {hasSizes ? (
                          <p className="text-orange font-bold text-xs">S ฿{item.priceS} / XL ฿{item.priceXL}</p>
                        ) : (
                          <p className="text-orange font-bold">฿{item.priceTHB}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Scan notice */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-navy text-cream px-4 py-4 text-center shadow-2xl">
        <div className="flex items-center justify-center gap-2 mb-0.5">
          <QrCode size={16} className="text-orange shrink-0" />
          <p className="font-semibold text-sm">ต้องการสั่งอาหาร?</p>
        </div>
        <p className="text-cream/60 text-xs">โปรดสแกน QR Code ที่โต๊ะ หรือติดต่อพนักงาน</p>
      </div>
    </>
  );
}
