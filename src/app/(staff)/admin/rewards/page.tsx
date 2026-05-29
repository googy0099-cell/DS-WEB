"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import Image from "next/image";

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

      {/* Card grid */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-gray-400">ยังไม่มีรายการ — กด &quot;+ เพิ่มรางวัล&quot;</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden border-2 ${item.isAvailable ? "border-transparent" : "border-gray-200 opacity-60"}`}>
              {item.imageUrl ? (
                <div className="relative w-full aspect-video bg-gray-100">
                  <Image src={item.imageUrl} alt={item.nameTh} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-full aspect-video bg-sand/40 flex items-center justify-center text-3xl">🎁</div>
              )}
              <div className="p-3 space-y-2">
                <div>
                  <p className="font-semibold text-navy text-sm leading-tight">{item.nameTh}</p>
                  {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                  <p className="text-orange font-bold text-xs mt-1">🎲 {item.cost} แต้ม</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => toggleAvailable(item)}
                    className={`flex-1 text-xs font-semibold py-1 rounded-lg ${item.isAvailable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                    {item.isAvailable ? "เปิด" : "ปิด"}
                  </button>
                  <button onClick={() => openEdit(item)} className="flex-1 text-xs text-navy border border-sand py-1 rounded-lg hover:border-navy">แก้ไข</button>
                  <button onClick={() => deleteItem(item.id)} className="text-xs text-red-400 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">ลบ</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {adding && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
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
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      const { url } = await res.json();
      setForm((p) => ({ ...p, imageUrl: url }));
    }
  }

  return (
    <div className="space-y-3">
      {/* Image upload */}
      <div>
        <label className="text-xs font-semibold text-navy block mb-1">รูปภาพ</label>
        <div
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-sand hover:border-orange rounded-xl overflow-hidden transition-colors"
        >
          {form.imageUrl ? (
            <div className="relative w-full aspect-video">
              <Image src={form.imageUrl} alt="reward" fill className="object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <p className="text-white text-xs font-semibold">เปลี่ยนรูป</p>
              </div>
            </div>
          ) : (
            <div className="w-full aspect-video flex flex-col items-center justify-center text-gray-400 gap-1">
              <span className="text-2xl">{uploading ? "⏳" : "📷"}</span>
              <span className="text-xs">{uploading ? "กำลังอัปโหลด..." : "กดเพื่อเลือกรูป"}</span>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
        {form.imageUrl && (
          <button onClick={() => setForm((p) => ({ ...p, imageUrl: "" }))} className="text-xs text-red-400 mt-1">ลบรูป</button>
        )}
      </div>

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
