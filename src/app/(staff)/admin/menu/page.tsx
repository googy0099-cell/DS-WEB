"use client";

import { useState } from "react";
import useSWR from "swr";
import ImageUpload from "@/components/admin/ImageUpload";
import NumpadInput from "@/components/admin/NumpadInput";

type MenuItem = {
  id: number;
  nameTh: string;
  nameEn: string;
  category: string;
  priceTHB: number;
  priceS: number | null;
  priceXL: number | null;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  sellStartTime: string | null;
  sellEndTime: string | null;
  addonGroups: { id: number; nameTh: string }[];
  optionGroups: { id: number; nameTh: string; isRequired: boolean }[];
};

type AddonGroup = { id: number; nameTh: string; isActive: boolean };
type OptionGroup = { id: number; nameTh: string; isRequired: boolean; isActive: boolean };
type StockItem = { id: number; name: string; unit: string; currentQty: number };
type Recipe = { id: number; stockItemId: number; qtyUsed: number; stockItem: StockItem };

export type MenuCategory = { id: string; label: string; icon: string; isActive: boolean; isBuiltin?: boolean };

const BUILTIN_CATEGORIES: MenuCategory[] = [
  { id: "milktea", label: "Milk & Tea", icon: "🧋", isActive: true, isBuiltin: true },
  { id: "coffee", label: "Coffee", icon: "☕", isActive: true, isBuiltin: true },
  { id: "soda", label: "Soda Zaa", icon: "🥤", isActive: true, isBuiltin: true },
  { id: "drink", label: "เครื่องดื่ม", icon: "🧊", isActive: true, isBuiltin: true },
  { id: "food", label: "อาหารจานเดียว", icon: "🍜", isActive: true, isBuiltin: true },
  { id: "snack", label: "ของทานเล่น", icon: "🍿", isActive: true, isBuiltin: true },
  { id: "dessert", label: "ของหวาน", icon: "🍮", isActive: true, isBuiltin: true },
];

function mergeCategories(saved: string | undefined): MenuCategory[] {
  try {
    const custom: MenuCategory[] = saved ? JSON.parse(saved) : [];
    const customIds = new Set(custom.map((c) => c.id));
    const merged = BUILTIN_CATEGORIES.map((b) => {
      const found = custom.find((c) => c.id === b.id);
      return found ? { ...b, isActive: found.isActive } : b;
    });
    custom.filter((c) => !BUILTIN_CATEGORIES.find((b) => b.id === c.id)).forEach((c) => merged.push(c));
    void customIds;
    return merged;
  } catch { return BUILTIN_CATEGORIES; }
}

const EMPTY = {
  nameTh: "", nameEn: "", category: "milktea", priceTHB: 0,
  priceS: null as number | null, priceXL: null as number | null,
  imageUrl: null as string | null, isAvailable: true, isFeatured: false,
  sellStartTime: null as string | null, sellEndTime: null as string | null,
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminMenuPage() {
  const { data: items = [], mutate } = useSWR<MenuItem[]>("/api/menu", fetcher);
  const { data: allAddonGroups = [] } = useSWR<AddonGroup[]>("/api/addon-groups", fetcher);
  const { data: allOptionGroups = [] } = useSWR<OptionGroup[]>("/api/option-groups", fetcher);
  const { data: siteSettings, mutate: mutateSite } = useSWR<{ menu_categories?: string }>("/api/site-settings", fetcher);

  const categories = mergeCategories(siteSettings?.menu_categories);
  const activeCategories = categories.filter((c) => c.isActive);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partial<typeof EMPTY> & { id?: number } | null>(null);
  const [selectedAddonGroupIds, setSelectedAddonGroupIds] = useState<number[]>([]);
  const [selectedOptionGroupIds, setSelectedOptionGroupIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");

  // Recipe modal state
  const [recipeMenuItem, setRecipeMenuItem] = useState<MenuItem | null>(null);
  const { data: allStockItems = [] } = useSWR<StockItem[]>("/api/stock/items", fetcher);
  const { data: recipes = [], mutate: mutateRecipes } = useSWR<Recipe[]>(
    recipeMenuItem ? `/api/stock/recipes?menuItemId=${recipeMenuItem.id}` : null,
    fetcher
  );
  const [newRecipeStockId, setNewRecipeStockId] = useState("");
  const [newRecipeQty, setNewRecipeQty] = useState("");
  const [recipeSaving, setRecipeSaving] = useState(false);

  // Category manager
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🍽️");
  const [catSaving, setCatSaving] = useState(false);

  async function saveCategories(cats: MenuCategory[]) {
    setCatSaving(true);
    await fetch("/api/site-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menu_categories: JSON.stringify(cats) }),
    });
    await mutateSite();
    setCatSaving(false);
  }

  async function toggleCategoryActive(cat: MenuCategory) {
    await saveCategories(categories.map((c) => c.id === cat.id ? { ...c, isActive: !c.isActive } : c));
  }

  async function addCategory() {
    if (!newCatLabel.trim()) return;
    const id = newCatLabel.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `cat-${Date.now()}`;
    const newCat: MenuCategory = { id, label: newCatLabel.trim(), icon: newCatIcon, isActive: true };
    await saveCategories([...categories, newCat]);
    setNewCatLabel(""); setNewCatIcon("🍽️");
  }

  async function deleteCategory(cat: MenuCategory) {
    if (!confirm(`ลบหมวด "${cat.label}"? เมนูในหมวดนี้จะยังอยู่ในระบบ แต่จะไม่แสดงบนเว็บ`)) return;
    await saveCategories(categories.filter((c) => c.id !== cat.id));
  }

  function openAdd() {
    setEditing({ ...EMPTY });
    setSelectedAddonGroupIds([]);
    setSelectedOptionGroupIds([]);
    setShowModal(true);
  }

  function openEdit(item: MenuItem) {
    setEditing({ ...item });
    setSelectedAddonGroupIds(item.addonGroups.map((g) => g.id));
    setSelectedOptionGroupIds(item.optionGroups.map((g) => g.id));
    setShowModal(true);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const { addonGroups: _ag, optionGroups: _og, ...payload } = editing as MenuItem;
    const method = editing.id ? "PATCH" : "POST";
    await fetch("/api/menu", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        addonGroupIds: selectedAddonGroupIds,
        optionGroupIds: selectedOptionGroupIds,
      }),
    });
    await mutate();
    setShowModal(false);
    setSaving(false);
  }

  async function toggleAvailable(item: MenuItem) {
    await fetch("/api/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isAvailable: !item.isAvailable }),
    });
    mutate();
  }

  async function toggleFeatured(item: MenuItem) {
    await fetch("/api/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isFeatured: !item.isFeatured }),
    });
    mutate();
  }

  async function deleteItem(id: number) {
    if (!confirm("ลบรายการนี้?")) return;
    await fetch("/api/menu", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
  }

  function toggleGroupId(ids: number[], id: number): number[] {
    return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  }

  async function addRecipe() {
    if (!recipeMenuItem || !newRecipeStockId || !parseFloat(newRecipeQty)) return;
    setRecipeSaving(true);
    await fetch("/api/stock/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId: recipeMenuItem.id, stockItemId: Number(newRecipeStockId), qtyUsed: parseFloat(newRecipeQty) }),
    });
    await mutateRecipes();
    setNewRecipeStockId(""); setNewRecipeQty("");
    setRecipeSaving(false);
  }

  async function deleteRecipe(id: number) {
    await fetch(`/api/stock/recipes/${id}`, { method: "DELETE" });
    await mutateRecipes();
  }

  const filtered = filterCat === "all" ? items : items.filter((i) => i.category === filterCat);
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-navy">จัดการเมนู</h1>
        <button onClick={openAdd} className="bg-orange text-white font-semibold px-4 py-2 rounded-xl text-sm">
          + เพิ่มเมนู
        </button>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        <button onClick={() => setFilterCat("all")} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${filterCat === "all" ? "bg-navy text-cream" : "bg-white text-navy border border-sand"}`}>
          ทั้งหมด ({items.length})
        </button>
        {categories.map((cat) => (
          <button key={cat.id} onClick={() => setFilterCat(cat.id)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${filterCat === cat.id ? "bg-navy text-cream" : !cat.isActive ? "bg-white text-gray-300 border border-sand line-through" : "bg-white text-navy border border-sand"}`}>
            {cat.icon} {cat.label} ({items.filter((i) => i.category === cat.id).length})
          </button>
        ))}
        <button onClick={() => setShowCatManager(true)} className="shrink-0 px-3 py-1.5 rounded-full text-sm font-medium bg-white text-orange border border-orange/40 hover:bg-orange/5">
          ⚙️ หมวดหมู่
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand/40 border-b border-sand">
            <tr>
              <th className="text-left p-3 text-navy font-semibold">รายการ</th>
              <th className="text-left p-3 text-navy font-semibold hidden md:table-cell">หมวด</th>
              <th className="text-right p-3 text-navy font-semibold">ราคา</th>
              <th className="text-center p-3 text-navy font-semibold">สถานะ</th>
              <th className="text-center p-3 text-navy font-semibold hidden md:table-cell">เวลาขาย</th>
              <th className="text-center p-3 text-navy font-semibold">หน้าแรก</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b border-sand/50 last:border-0">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.nameTh} className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-sand flex items-center justify-center text-lg">🍽️</div>
                    )}
                    <div>
                      <p className="font-medium text-navy">{item.nameTh}</p>
                      <p className="text-gray-400 text-xs">{item.nameEn}</p>
                      {item.category === "gametime" && (() => {
                        const m = item.nameEn?.match(/^gametime-([A-D])$/i);
                        return m
                          ? <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">⏱️ Package {m[1].toUpperCase()}</span>
                          : <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-medium">⚠️ ไม่ได้ลิงค์กับแพ็กเกจ</span>;
                      })()}
                      {(item.addonGroups?.length > 0 || item.optionGroups?.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {item.addonGroups?.map((g) => (
                            <span key={g.id} className="text-[10px] bg-orange/10 text-orange px-1.5 py-0.5 rounded-full">+{g.nameTh}</span>
                          ))}
                          {item.optionGroups?.map((g) => (
                            <span key={g.id} className="text-[10px] bg-navy/10 text-navy px-1.5 py-0.5 rounded-full">{g.nameTh}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-gray-500 hidden md:table-cell">{catMap[item.category]?.icon} {catMap[item.category]?.label ?? item.category}</td>
                <td className="p-3 text-right font-bold text-navy text-sm">
                  {item.priceS != null && item.priceXL != null
                    ? `S ฿${item.priceS} / XL ฿${item.priceXL}`
                    : `฿${item.priceTHB}`}
                </td>
                <td className="p-3 text-center">
                  <button onClick={() => toggleAvailable(item)} className={`text-xs px-2 py-1 rounded-full font-medium ${item.isAvailable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {item.isAvailable ? "เปิด" : "ปิด"}
                  </button>
                </td>
                <td className="p-3 text-center hidden md:table-cell">
                  {item.sellStartTime && item.sellEndTime ? (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      ⏰ {item.sellStartTime}–{item.sellEndTime}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">ตลอดเวลา</span>
                  )}
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => toggleFeatured(item)}
                    title="แสดงบนหน้าแรก"
                    className={`text-lg transition-transform ${item.isFeatured ? "scale-110" : "opacity-30"}`}
                  >
                    ⭐
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(item)} className="text-xs text-orange hover:underline">แก้ไข</button>
                    <button onClick={() => { setRecipeMenuItem(item); setNewRecipeStockId(""); setNewRecipeQty(""); }} className="text-xs text-navy/60 hover:text-navy">สูตร</button>
                    <button onClick={() => deleteItem(item.id)} className="text-xs text-red-400 hover:underline">ลบ</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-400 py-8">ไม่มีรายการ</p>}
      </div>

      {/* Modal */}
      {/* Category Manager Modal */}
      {showCatManager && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowCatManager(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h2 className="font-bold text-navy text-lg mb-4">⚙️ จัดการหมวดหมู่</h2>
            <div className="space-y-2 max-h-72 overflow-y-auto mb-4">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-2 p-2 rounded-xl border border-sand">
                  <span className="text-xl w-7 text-center">{cat.icon}</span>
                  <span className={`flex-1 text-sm font-medium ${cat.isActive ? "text-navy" : "text-gray-400 line-through"}`}>{cat.label}</span>
                  <button
                    onClick={() => toggleCategoryActive(cat)}
                    className={`text-xs px-2 py-1 rounded-lg font-medium border ${cat.isActive ? "border-green-200 text-green-700 bg-green-50" : "border-gray-200 text-gray-400"}`}
                  >
                    {cat.isActive ? "แสดง" : "ซ่อน"}
                  </button>
                  {!cat.isBuiltin && (
                    <button onClick={() => deleteCategory(cat)} className="text-xs text-red-400 hover:text-red-600 px-1">🗑️</button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mb-3">+ เพิ่มหมวดหมู่ใหม่</p>
            <div className="flex gap-2 mb-4">
              <input
                type="text" value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)}
                className="w-14 text-center border border-sand rounded-xl px-2 py-2 text-lg"
                placeholder="🍽️"
              />
              <input
                type="text" value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)}
                placeholder="ชื่อหมวดหมู่"
                className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
              />
              <button onClick={addCategory} disabled={!newCatLabel.trim() || catSaving}
                className="bg-orange text-white px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                เพิ่ม
              </button>
            </div>
            <button onClick={() => setShowCatManager(false)} className="w-full border border-sand text-navy font-semibold py-2.5 rounded-xl text-sm">ปิด</button>
          </div>
        </div>
      )}

      {/* Recipe Editor Modal */}
      {recipeMenuItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setRecipeMenuItem(null)}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="font-bold text-navy text-lg">📦 สูตรวัตถุดิบ</h3>
              <p className="text-sm text-gray-400 mt-0.5">{recipeMenuItem.nameTh}</p>
            </div>

            {/* Current recipes */}
            <div className="space-y-2">
              {recipes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">ยังไม่มีวัตถุดิบในสูตรนี้</p>
              ) : (
                recipes.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-sand/30 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-navy">{r.stockItem.name}</p>
                      <p className="text-xs text-gray-400">{r.qtyUsed} {r.stockItem.unit} / จาน · คงเหลือ {r.stockItem.currentQty} {r.stockItem.unit}</p>
                    </div>
                    <button onClick={() => deleteRecipe(r.id)} className="text-gray-300 hover:text-red-400 text-lg ml-3">🗑️</button>
                  </div>
                ))
              )}
            </div>

            {/* Add new recipe */}
            <div className="border-t border-sand pt-3 space-y-2">
              <p className="text-xs font-semibold text-navy">+ เพิ่มวัตถุดิบ</p>
              <select value={newRecipeStockId} onChange={(e) => setNewRecipeStockId(e.target.value)}
                className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange">
                <option value="">เลือกวัตถุดิบ...</option>
                {allStockItems.filter((s) => !recipes.find((r) => r.stockItemId === s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                ))}
              </select>
              <div className="flex gap-2">
                <NumpadInput value={newRecipeQty} onChange={(v) => setNewRecipeQty(v === 0 ? "" : String(v))}
                  allowDecimal placeholder="จำนวน/จาน"
                  className="flex-1 border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
                <button onClick={addRecipe} disabled={recipeSaving || !newRecipeStockId || !parseFloat(newRecipeQty)}
                  className="bg-orange text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-40">
                  {recipeSaving ? "..." : "เพิ่ม"}
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-400 bg-sand/20 rounded-xl px-3 py-2">
              ℹ️ ระบบจะตัดสต็อกตามสูตรนี้ทุกครั้งที่ออเดอร์ถูก SERVED
            </p>

            <button onClick={() => setRecipeMenuItem(null)} className="w-full border border-sand text-gray-400 py-3 rounded-2xl text-sm">ปิด</button>
          </div>
        </div>
      )}

      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <h2 className="font-bold text-navy text-lg mb-4">
              {editing.id ? "แก้ไขเมนู" : "เพิ่มเมนูใหม่"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-navy block mb-1">ชื่อ (ไทย) *</label>
                <input type="text" value={editing.nameTh ?? ""} onChange={(e) => setEditing({ ...editing, nameTh: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-navy block mb-1">ชื่อ (อังกฤษ)</label>
                <input type="text" value={editing.nameEn ?? ""} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none" />
                {editing.category === "gametime" && (() => {
                  const key = (editing.nameEn ?? "").match(/^gametime-([A-D])$/i)?.[1]?.toUpperCase();
                  return key
                    ? <p className="text-xs text-blue-600 mt-1">✅ ลิงค์กับ Package {key} ในหน้าจัดการเวลา</p>
                    : <p className="text-xs text-orange mt-1">⚠️ ต้องตั้งเป็น <b>gametime-A</b>, <b>gametime-B</b>, <b>gametime-C</b> หรือ <b>gametime-D</b> เพื่อลิงค์กับแพ็กเกจในหน้าจัดการเวลา</p>;
                })()}
              </div>
              <div>
                <label className="text-xs font-medium text-navy block mb-1">หมวดหมู่</label>
                <select value={editing.category ?? "milktea"} onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none">
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-navy block mb-1">ราคาปกติ ฿ (สำหรับเมนูที่ไม่มีไซส์)</label>
                <NumpadInput value={editing.priceTHB || ""} onChange={(v) => setEditing({ ...editing, priceTHB: v })}
                  placeholder="0"
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">ราคา S ฿</label>
                  <NumpadInput value={editing.priceS ?? ""} onChange={(v) => setEditing({ ...editing, priceS: v || null })}
                    placeholder="ไม่มีไซส์"
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">ราคา XL ฿</label>
                  <NumpadInput value={editing.priceXL ?? ""} onChange={(v) => setEditing({ ...editing, priceXL: v || null })}
                    placeholder="ไม่มีไซส์"
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-navy block mb-1">รูปเมนู</label>
                <ImageUpload value={editing.imageUrl ?? ""} onChange={(url) => setEditing({ ...editing, imageUrl: url || null })} />
              </div>

              <div>
                <label className="text-xs font-medium text-navy block mb-1">⏰ เวลารับออเดอร์ <span className="font-normal text-gray-400">(เว้นว่าง = รับตลอดเวลา)</span></label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={(editing as { sellStartTime?: string | null }).sellStartTime ?? ""}
                    onChange={(e) => setEditing({ ...editing, sellStartTime: e.target.value || null })}
                    className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                  <span className="text-gray-400 text-sm shrink-0">ถึง</span>
                  <input
                    type="time"
                    value={(editing as { sellEndTime?: string | null }).sellEndTime ?? ""}
                    onChange={(e) => setEditing({ ...editing, sellEndTime: e.target.value || null })}
                    className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                  {((editing as { sellStartTime?: string | null }).sellStartTime || (editing as { sellEndTime?: string | null }).sellEndTime) && (
                    <button
                      type="button"
                      onClick={() => setEditing({ ...editing, sellStartTime: null, sellEndTime: null })}
                      className="text-xs text-red-400 hover:text-red-600 shrink-0"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">เช่น 15:00 ถึง 22:00 — นอกเวลานี้จะขึ้น "ไม่รับออเดอร์ตอนนี้" ในเมนูลูกค้า</p>
              </div>

              {/* Addon Groups */}
              {allAddonGroups.filter((g) => g.isActive).length > 0 && (
                <div>
                  <label className="text-xs font-medium text-navy block mb-2">Set Add-on ที่ใช้กับเมนูนี้</label>
                  <div className="space-y-1.5">
                    {allAddonGroups.filter((g) => g.isActive).map((g) => (
                      <label key={g.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-sand hover:border-orange cursor-pointer transition-colors">
                        <input type="checkbox" checked={selectedAddonGroupIds.includes(g.id)} onChange={() => setSelectedAddonGroupIds(toggleGroupId(selectedAddonGroupIds, g.id))} className="accent-orange" />
                        <span className="text-sm text-navy">{g.nameTh}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Option Groups */}
              {allOptionGroups.filter((g) => g.isActive).length > 0 && (
                <div>
                  <label className="text-xs font-medium text-navy block mb-2">กลุ่มตัวเลือกที่ใช้กับเมนูนี้</label>
                  <div className="space-y-1.5">
                    {allOptionGroups.filter((g) => g.isActive).map((g) => (
                      <label key={g.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-sand hover:border-orange cursor-pointer transition-colors">
                        <input type="checkbox" checked={selectedOptionGroupIds.includes(g.id)} onChange={() => setSelectedOptionGroupIds(toggleGroupId(selectedOptionGroupIds, g.id))} className="accent-orange" />
                        <span className="text-sm text-navy flex-1">{g.nameTh}</span>
                        {g.isRequired && <span className="text-xs text-orange">บังคับ</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.isAvailable ?? true} onChange={(e) => setEditing({ ...editing, isAvailable: e.target.checked })} />
                เปิดให้สั่ง
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={(editing as { isFeatured?: boolean }).isFeatured ?? false} onChange={(e) => setEditing({ ...editing, isFeatured: e.target.checked })} />
                ⭐ แสดงบนหน้าแรก (เมนูแนะนำ)
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-sand text-navy font-semibold py-2.5 rounded-xl text-sm">ยกเลิก</button>
              <button onClick={save} disabled={saving || !editing.nameTh} className="flex-1 bg-orange text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
