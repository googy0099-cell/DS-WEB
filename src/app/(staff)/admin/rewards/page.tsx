"use client";

import { useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type RewardItem = { id: number; nameTh: string; description: string; cost: number; imageUrl: string | null; isAvailable: boolean };
const BLANK = { nameTh: "", description: "", cost: 10, imageUrl: "" };

export default function RewardsAdminPage() {
  const { data, mutate } = useSWR<RewardItem[]>("/api/rewards", fetcher);
  const items = data ?? [];

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<RewardItem | null>(null);
  const [editForm, setEditForm] = useState(BLANK);

  async function addItem() {
    if (!form.nameTh.trim() || form.cost < 1) return;
    setSaving(true);
    await fetch("/api/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setAdding(false);
    setForm(BLANK);
    mutate();
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/rewards/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSaving(false);
    setEditing(null);
    mutate();
  }

  async function toggleAvailable(item: RewardItem) {
    await fetch(`/api/rewards/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !item.isAvailable }),
    });
    mutate();
  }

  async function deleteItem(id: number) {
    if (!confirm("ลบรายการนี้?")) return;
    await fetch(`/api/rewards/${id}`, { method: "DELETE" });
    mutate();
  }

  function openEdit(item: RewardItem) {
    setEditing(item);
    setEditForm({ nameTh: item.nameTh, description: item.description, cost: item.cost, imageUrl: item.imageUrl ?? "" });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-navy">🎁 จัดการรางวัลแลกแต้ม</h1>
        <button onClick={() => setAdding(true)} className="bg-orange text-white text-sm font-bold px-4 py-2 rounded-xl">+ เพิ่มรางวัล</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sand text-xs text-gray-400">
              <th className="text-left p-3 pl-4">ชื่อรางวัล</th>
              <th className="text-left p-3">รายละเอียด</th>
              <th className="text-right p-3">ราคา 🎲</th>
              <th className="text-center p-3">สถานะ</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-sand/50">
            {items.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-gray-400 py-10">ยังไม่มีรายการ — กด &quot;+ เพิ่มรางวัล&quot;</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="hover:bg-sand/20">
                <td className="p-3 pl-4 font-semibold text-navy">{item.nameTh}</td>
                <td className="p-3 text-gray-400 text-xs max-w-[160px] truncate">{item.description || "-"}</td>
                <td className="p-3 text-right font-bold text-orange">{item.cost}</td>
                <td className="p-3 text-center">
                  <button onClick={() => toggleAvailable(item)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${item.isAvailable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                    {item.isAvailable ? "เปิด" : "ปิด"}
                  </button>
                </td>
                <td className="p-3 pr-4 flex gap-2 justify-end">
                  <button onClick={() => openEdit(item)} className="text-xs text-navy border border-sand px-2.5 py-1 rounded-lg hover:border-navy">แก้ไข</button>
                  <button onClick={() => deleteItem(item.id)} className="text-xs text-red-400 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50">ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add modal */}
      {adding && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-navy text-lg">เพิ่มรางวัลใหม่</h3>
            <RewardForm form={form} setForm={setForm} />
            <div className="flex gap-2">
              <button onClick={() => { setAdding(false); setForm(BLANK); }} className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm">ยกเลิก</button>
              <button onClick={addItem} disabled={saving || !form.nameTh.trim()} className="flex-1 bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40">
                {saving ? "..." : "เพิ่ม"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-navy text-lg">แก้ไขรางวัล</h3>
            <RewardForm form={editForm} setForm={setEditForm} />
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm">ยกเลิก</button>
              <button onClick={saveEdit} disabled={saving || !editForm.nameTh.trim()} className="flex-1 bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40">
                {saving ? "..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RewardForm({ form, setForm }: { form: typeof BLANK; setForm: React.Dispatch<React.SetStateAction<typeof BLANK>> }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-navy block mb-1">ชื่อรางวัล *</label>
        <input value={form.nameTh} onChange={(e) => setForm((p) => ({ ...p, nameTh: e.target.value }))}
          placeholder="เช่น เล่นฟรี 1 ชั่วโมง"
          className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
      </div>
      <div>
        <label className="text-xs font-semibold text-navy block mb-1">รายละเอียด</label>
        <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="รายละเอียดเพิ่มเติม"
          className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
      </div>
      <div>
        <label className="text-xs font-semibold text-navy block mb-1">ราคา (ลูกเต๋า 🎲) *</label>
        <input type="number" min={1} value={form.cost} onChange={(e) => setForm((p) => ({ ...p, cost: Number(e.target.value) }))}
          className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
      </div>
    </div>
  );
}
