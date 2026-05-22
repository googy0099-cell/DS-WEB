"use client";

import { useState } from "react";
import useSWR from "swr";
import ImageUpload from "@/components/admin/ImageUpload";

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
};

const CATEGORIES = ["milktea", "coffee", "soda", "drink", "food", "snack", "dessert"];
const CAT_LABELS: Record<string, string> = {
  milktea: "Milk & Tea",
  coffee: "Coffee",
  soda: "Soda Zaa",
  drink: "เครื่องดื่ม",
  food: "อาหารจานเดียว",
  snack: "ของทานเล่น",
  dessert: "ของหวาน",
};

const EMPTY: Omit<MenuItem, "id"> = {
  nameTh: "", nameEn: "", category: "milktea", priceTHB: 0, priceS: null, priceXL: null, imageUrl: null, isAvailable: true,
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminMenuPage() {
  const { data: items = [], mutate } = useSWR<MenuItem[]>("/api/menu", fetcher);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");

  function openAdd() {
    setEditing({ ...EMPTY });
    setShowModal(true);
  }

  function openEdit(item: MenuItem) {
    setEditing({ ...item });
    setShowModal(true);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const method = editing.id ? "PATCH" : "POST";
    const body = editing.id ? editing : { ...editing };
    await fetch("/api/menu", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  async function deleteItem(id: number) {
    if (!confirm("ลบรายการนี้?")) return;
    await fetch("/api/menu", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
  }

  const filtered = filterCat === "all" ? items : items.filter((i) => i.category === filterCat);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-navy">จัดการเมนู</h1>
        <button
          onClick={openAdd}
          className="bg-orange text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          + เพิ่มเมนู
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFilterCat("all")}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${filterCat === "all" ? "bg-navy text-cream" : "bg-white text-navy border border-sand"}`}
        >
          ทั้งหมด ({items.length})
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${filterCat === cat ? "bg-navy text-cream" : "bg-white text-navy border border-sand"}`}
          >
            {CAT_LABELS[cat]} ({items.filter((i) => i.category === cat).length})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand/40 border-b border-sand">
            <tr>
              <th className="text-left p-3 text-navy font-semibold">รายการ</th>
              <th className="text-left p-3 text-navy font-semibold hidden md:table-cell">หมวด</th>
              <th className="text-right p-3 text-navy font-semibold">ราคา</th>
              <th className="text-center p-3 text-navy font-semibold">สถานะ</th>
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
                    </div>
                  </div>
                </td>
                <td className="p-3 text-gray-500 hidden md:table-cell">{CAT_LABELS[item.category]}</td>
                <td className="p-3 text-right font-bold text-navy text-sm">
                  {item.priceS != null && item.priceXL != null
                    ? `S ฿${item.priceS} / XL ฿${item.priceXL}`
                    : `฿${item.priceTHB}`}
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => toggleAvailable(item)}
                    className={`text-xs px-2 py-1 rounded-full font-medium ${item.isAvailable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                  >
                    {item.isAvailable ? "เปิด" : "ปิด"}
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(item)} className="text-xs text-orange hover:underline">แก้ไข</button>
                    <button onClick={() => deleteItem(item.id)} className="text-xs text-red-400 hover:underline">ลบ</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8">ไม่มีรายการ</p>
        )}
      </div>

      {/* Modal */}
      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <h2 className="font-bold text-navy text-lg mb-4">
              {editing.id ? "แก้ไขเมนู" : "เพิ่มเมนูใหม่"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-navy block mb-1">ชื่อ (ไทย) *</label>
                <input
                  type="text"
                  value={editing.nameTh ?? ""}
                  onChange={(e) => setEditing({ ...editing, nameTh: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-navy block mb-1">ชื่อ (อังกฤษ)</label>
                <input
                  type="text"
                  value={editing.nameEn ?? ""}
                  onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-navy block mb-1">หมวดหมู่</label>
                <select
                  value={editing.category ?? "milktea"}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CAT_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-navy block mb-1">ราคาปกติ ฿ (สำหรับเมนูที่ไม่มีไซส์)</label>
                <input
                  type="number"
                  value={editing.priceTHB ?? 0}
                  onChange={(e) => setEditing({ ...editing, priceTHB: parseInt(e.target.value) || 0 })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">ราคา S ฿ (ถ้ามีไซส์)</label>
                  <input
                    type="number"
                    placeholder="ไม่มีไซส์"
                    value={editing.priceS ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        priceS: e.target.value === "" ? null : parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">ราคา XL ฿ (ถ้ามีไซส์)</label>
                  <input
                    type="number"
                    placeholder="ไม่มีไซส์"
                    value={editing.priceXL ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        priceXL: e.target.value === "" ? null : parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-navy block mb-1">รูปเมนู</label>
                <ImageUpload
                  value={editing.imageUrl ?? ""}
                  onChange={(url) => setEditing({ ...editing, imageUrl: url || null })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.isAvailable ?? true}
                  onChange={(e) => setEditing({ ...editing, isAvailable: e.target.checked })}
                />
                เปิดให้สั่ง
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-sand text-navy font-semibold py-2.5 rounded-xl text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={save}
                disabled={saving || !editing.nameTh}
                className="flex-1 bg-orange text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
