"use client";

import { useEffect, useState, use } from "react";
import { useOrderStore } from "@/store/orderStore";
import MenuCard from "@/components/orders/MenuCard";
import CartDrawer from "@/components/orders/CartDrawer";
import type { MenuItemType } from "@/types";
import Image from "next/image";

type MenuCategory = { id: string; label: string; icon: string; isActive: boolean; staffOnly?: boolean };

const DEFAULT_CATEGORIES: MenuCategory[] = [
  { id: "milktea", label: "Milk & Tea", icon: "🧋", isActive: true },
  { id: "coffee", label: "Coffee", icon: "☕", isActive: true },
  { id: "soda", label: "Soda Zaa", icon: "🥤", isActive: true },
  { id: "drink", label: "เครื่องดื่ม", icon: "🧊", isActive: true },
  { id: "food", label: "อาหารจานเดียว", icon: "🍜", isActive: true },
  { id: "snack", label: "ของทานเล่น", icon: "🍿", isActive: true },
  { id: "dessert", label: "ของหวาน", icon: "🍮", isActive: true },
];

function parseCategories(saved: string | undefined): MenuCategory[] {
  try {
    const custom: MenuCategory[] = saved ? JSON.parse(saved) : [];
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

function getBangkokHHMM(): string {
  const now = new Date();
  const bkk = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60_000);
  return `${String(bkk.getHours()).padStart(2, "0")}:${String(bkk.getMinutes()).padStart(2, "0")}`;
}

function isWithinSellHours(start: string | null | undefined, end: string | null | undefined): boolean {
  if (!start || !end) return true;
  const now = getBangkokHHMM();
  return now >= start && now <= end;
}

export default function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId: tableIdParam } = use(params);
  const tableId = parseInt(tableIdParam);
  const [menu, setMenu] = useState<MenuItemType[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>(DEFAULT_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/menu").then((r) => r.json()),
      fetch("/api/site-settings").then((r) => r.json()).catch(() => ({})),
    ]).then(([menuData, settings]) => {
      setMenu(menuData);
      const cats = parseCategories(settings?.menu_categories);
      setCategories(cats);
      if (cats.length > 0) setActiveCategory(cats[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tableId]);

  const availableMenu = menu.filter((m) => m.isAvailable && m.category !== "gametime" && isWithinSellHours(m.sellStartTime, m.sellEndTime));
  const visibleCategories = categories.filter((c) => c.isActive && availableMenu.some((m) => m.category === c.id));
  const filtered = availableMenu.filter((m) => m.category === activeCategory);

  return (
    <div className="min-h-screen bg-cream pb-32">
      {/* Header */}
      <div className="bg-navy px-4 pt-4 pb-6">
        <div className="flex items-center gap-3">
          <Image src="/DS-new-logo.png" alt="Dice Shop" width={50} height={28} className="object-contain brightness-0 invert" />
          <div>
            <p className="text-cream/70 text-xs">โต๊ะที่</p>
            <p className="text-cream text-xl font-bold">{tableId}</p>
          </div>
        </div>
        <h1 className="text-cream font-bold text-lg mt-3">เมนูอาหาร</h1>
      </div>

      {/* Category tabs */}
      <div className="sticky top-0 bg-cream border-b border-sand z-30">
        <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
          {visibleCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? "bg-navy text-cream"
                  : "bg-sand text-navy"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Menu list */}
      <div className="p-4 space-y-2">
        {loading ? (
          <div className="text-center py-12 text-gray-400">กำลังโหลดเมนู...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">ไม่มีรายการในหมวดนี้</div>
        ) : (
          filtered.map((item) => <MenuCard key={item.id} item={item} />)
        )}
      </div>

      <CartDrawer tableId={tableId} />
    </div>
  );
}
