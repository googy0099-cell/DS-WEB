"use client";

import { useState } from "react";
import useSWR from "swr";
import Image from "next/image";

type Recipe = {
  id: number;
  size: string;
  qtyUsed: number;
  stockItem: { name: string; unit: string };
};

type SOPItem = {
  id: number;
  nameTh: string;
  nameEn: string;
  category: string;
  priceTHB: number;
  priceS: number | null;
  priceXL: number | null;
  imageUrl: string | null;
  recipeNote: string | null;
  stockRecipes: Recipe[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function groupRecipesBySize(recipes: Recipe[]) {
  const catchAll = recipes.filter((r) => r.size === "");
  const sized = recipes.filter((r) => r.size !== "");

  if (catchAll.length === 0 && sized.length === 0) return [];

  // If only catch-all, return as single group
  if (sized.length === 0) return [{ label: null, items: catchAll }];

  // Group by size
  const map = new Map<string, Recipe[]>();
  for (const r of sized) {
    if (!map.has(r.size)) map.set(r.size, []);
    map.get(r.size)!.push(r);
  }
  const groups = Array.from(map.entries()).map(([size, items]) => ({ label: size, items }));
  if (catchAll.length > 0) groups.unshift({ label: "ทุกขนาด", items: catchAll });
  return groups;
}

export default function SOPPage() {
  const { data: items = [], isLoading } = useSWR<SOPItem[]>("/api/menu/sop", fetcher);

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  const categories = ["all", ...Array.from(new Set(items.map((i) => i.category)))];

  const filtered = items.filter((item) => {
    const matchCat = filterCat === "all" || item.category === filterCat;
    const q = search.toLowerCase();
    const matchSearch = !q || item.nameTh.toLowerCase().includes(q) || item.nameEn.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  if (isLoading) return <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-navy">📋 สูตรอาหาร SOP</h1>
        <p className="text-xs text-gray-400 mt-0.5">ปริมาณวัตถุดิบและวิธีการทำสำหรับพนักงาน</p>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อเมนู..."
            className="w-full border border-sand rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-orange"
          />
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="border border-sand rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange bg-white"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c === "all" ? "ทุกหมวด" : c}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-400 py-12">ไม่พบเมนูที่ค้นหา</p>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map((item) => {
          const isOpen = expanded === item.id;
          const recipeGroups = groupRecipesBySize(item.stockRecipes);
          const hasContent = recipeGroups.length > 0 || item.recipeNote;

          return (
            <div key={item.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Card header */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                onClick={() => setExpanded(isOpen ? null : item.id)}
              >
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.nameTh} width={48} height={48}
                    className="w-12 h-12 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-sand/50 shrink-0 flex items-center justify-center text-xl">🍽️</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-navy leading-tight">{item.nameTh}</p>
                  {item.nameEn && <p className="text-xs text-gray-400 truncate">{item.nameEn}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{item.category}</span>
                    {recipeGroups.length > 0 && (
                      <span className="text-xs bg-orange/10 text-orange px-1.5 py-0.5 rounded-full">
                        {item.stockRecipes.length} วัตถุดิบ
                      </span>
                    )}
                    {item.recipeNote && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">มีวิธีทำ</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    {item.priceS != null && item.priceXL != null ? (
                      <>
                        <p className="text-xs text-gray-400">S ฿{item.priceS}</p>
                        <p className="text-xs text-gray-400">XL ฿{item.priceXL}</p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-navy">฿{item.priceTHB}</p>
                    )}
                  </div>
                  {hasContent && (
                    <span className={`text-gray-300 text-lg transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>›</span>
                  )}
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && hasContent && (
                <div className="border-t border-sand/60 px-4 pb-4 pt-3 space-y-4">

                  {/* Ingredients */}
                  {recipeGroups.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-navy mb-2">🧪 ส่วนผสม</p>
                      {recipeGroups.map((group, gi) => (
                        <div key={gi} className="mb-2">
                          {group.label && (
                            <p className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-block mb-1.5
                              ${group.label === "S" ? "bg-blue-100 text-blue-700" : group.label === "XL" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                              {group.label}
                            </p>
                          )}
                          <div className="bg-sand/20 rounded-xl overflow-hidden">
                            {group.items.map((r, ri) => (
                              <div key={r.id} className={`flex justify-between px-3 py-2 text-sm ${ri > 0 ? "border-t border-sand/40" : ""}`}>
                                <span className="text-navy">{r.stockItem.name}</span>
                                <span className="font-semibold text-navy">{r.qtyUsed} <span className="text-gray-400 font-normal">{r.stockItem.unit}</span></span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Method */}
                  {item.recipeNote && (
                    <div>
                      <p className="text-xs font-bold text-navy mb-2">📝 วิธีทำ</p>
                      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-navy whitespace-pre-wrap leading-relaxed">
                        {item.recipeNote}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
