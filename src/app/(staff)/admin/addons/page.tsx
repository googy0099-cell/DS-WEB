"use client";

import { useState } from "react";
import useSWR from "swr";
import NumpadInput from "@/components/admin/NumpadInput";

type Addon = { id: number; nameTh: string; priceTHB: number; isActive: boolean };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminAddonsPage() {
  const { data: addons = [], mutate } = useSWR<Addon[]>("/api/addons?all=1", fetcher);
  const [editing, setEditing] = useState<Partial<Addon> | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!editing) return;
    setSaving(true);
    const method = editing.id ? "PATCH" : "POST";
    await fetch("/api/addons", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    await mutate();
    setEditing(null);
    setSaving(false);
  }

  async function del(id: number) {
    if (!confirm("ลบ Add-on นี้?")) return;
    await fetch("/api/addons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-navy">จัดการ Add-on</h1>
        <button
          onClick={() => setEditing({ nameTh: "", priceTHB: 0, isActive: true })}
          className="bg-orange text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          + เพิ่ม Add-on
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand/40 border-b border-sand">
            <tr>
              <th className="text-left p-3 text-navy font-semibold">ชื่อ</th>
              <th className="text-right p-3 text-navy font-semibold">ราคา</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {addons.map((addon) => (
              <tr key={addon.id} className="border-b border-sand/50 last:border-0">
                <td className="p-3 font-medium text-navy">{addon.nameTh}</td>
                <td className="p-3 text-right font-bold text-navy">+฿{addon.priceTHB}</td>
                <td className="p-3">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditing({ ...addon })}
                      className="text-xs text-orange hover:underline"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => del(addon.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {addons.length === 0 && (
          <p className="text-center text-gray-400 py-8">ยังไม่มี Add-on</p>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-bold text-navy text-lg mb-4">
              {editing.id ? "แก้ไข Add-on" : "เพิ่ม Add-on ใหม่"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-navy block mb-1">ชื่อ Add-on</label>
                <input
                  type="text"
                  value={editing.nameTh ?? ""}
                  onChange={(e) => setEditing({ ...editing, nameTh: e.target.value })}
                  placeholder="เช่น ครีมชีส"
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-navy block mb-1">ราคาเพิ่ม (฿)</label>
                <NumpadInput
                  value={editing.priceTHB || ""}
                  onChange={(v) => setEditing({ ...editing, priceTHB: v })}
                  placeholder="0"
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditing(null)}
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
