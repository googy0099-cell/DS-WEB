"use client";

import { useEffect, useState } from "react";

interface Discount {
  id: number;
  nameTh: string;
  type: "PERCENT" | "FIXED";
  value: number;
  isActive: boolean;
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ nameTh: "", type: "FIXED" as "PERCENT" | "FIXED", value: "" });
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ nameTh: "", type: "FIXED" as "PERCENT" | "FIXED", value: "" });

  async function load() {
    setLoading(true);
    const data = await fetch("/api/discounts").then((r) => r.json()).catch(() => []);
    setDiscounts(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!form.nameTh.trim() || !form.value) return;
    setSaving(true);
    await fetch("/api/discounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameTh: form.nameTh, type: form.type, value: Number(form.value) }),
    });
    setForm({ nameTh: "", type: "FIXED", value: "" });
    await load();
    setSaving(false);
  }

  async function handleToggle(d: Discount) {
    await fetch(`/api/discounts/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !d.isActive }),
    });
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("ลบส่วนลดนี้?")) return;
    await fetch(`/api/discounts/${id}`, { method: "DELETE" });
    load();
  }

  async function handleEdit(id: number) {
    setSaving(true);
    await fetch(`/api/discounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameTh: editForm.nameTh, type: editForm.type, value: Number(editForm.value) }),
    });
    setEditId(null);
    await load();
    setSaving(false);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-20">
      <h1 className="text-xl font-bold text-navy">💸 จัดการส่วนลด</h1>

      {/* Add form */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-gray-600">เพิ่มส่วนลดใหม่</p>
        <input
          type="text"
          placeholder="ชื่อส่วนลด เช่น ส่วนลดสมาชิก"
          value={form.nameTh}
          onChange={(e) => setForm((f) => ({ ...f, nameTh: e.target.value }))}
          className="w-full border border-sand rounded-xl px-3 py-2 text-sm text-navy"
        />
        <div className="flex gap-2">
          <div className="flex rounded-xl border border-sand overflow-hidden">
            <button
              onClick={() => setForm((f) => ({ ...f, type: "FIXED" }))}
              className={`px-4 py-2 text-sm font-bold transition-colors ${form.type === "FIXED" ? "bg-orange text-white" : "bg-white text-gray-400"}`}>
              ฿
            </button>
            <button
              onClick={() => setForm((f) => ({ ...f, type: "PERCENT" }))}
              className={`px-4 py-2 text-sm font-bold transition-colors ${form.type === "PERCENT" ? "bg-orange text-white" : "bg-white text-gray-400"}`}>
              %
            </button>
          </div>
          <input
            type="number"
            min={1}
            placeholder={form.type === "PERCENT" ? "1–100" : "จำนวนเงิน"}
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm text-center text-navy font-bold"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={saving || !form.nameTh.trim() || !form.value}
          className="w-full bg-orange text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
          {saving ? "กำลังบันทึก..." : "➕ เพิ่ม"}
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading && <p className="text-center text-sm text-gray-400">กำลังโหลด...</p>}
        {!loading && discounts.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-4">ยังไม่มีส่วนลด</p>
        )}
        {discounts.map((d) => (
          <div key={d.id} className={`bg-white rounded-2xl p-4 shadow-sm border transition-opacity ${!d.isActive ? "opacity-50" : ""}`}>
            {editId === d.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editForm.nameTh}
                  onChange={(e) => setEditForm((f) => ({ ...f, nameTh: e.target.value }))}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <div className="flex rounded-xl border border-sand overflow-hidden">
                    <button onClick={() => setEditForm((f) => ({ ...f, type: "FIXED" }))}
                      className={`px-4 py-2 text-sm font-bold ${editForm.type === "FIXED" ? "bg-orange text-white" : "bg-white text-gray-400"}`}>฿</button>
                    <button onClick={() => setEditForm((f) => ({ ...f, type: "PERCENT" }))}
                      className={`px-4 py-2 text-sm font-bold ${editForm.type === "PERCENT" ? "bg-orange text-white" : "bg-white text-gray-400"}`}>%</button>
                  </div>
                  <input type="number" min={1} value={editForm.value}
                    onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
                    className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm text-center font-bold" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(d.id)} disabled={saving}
                    className="flex-1 bg-navy text-white py-2 rounded-xl text-sm font-bold disabled:opacity-50">บันทึก</button>
                  <button onClick={() => setEditId(null)}
                    className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-xl text-sm">ยกเลิก</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-navy text-sm truncate">{d.nameTh}</p>
                  <p className="text-xs text-orange font-bold">
                    {d.type === "PERCENT" ? `${d.value}%` : `฿${d.value.toLocaleString()}`}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => { setEditId(d.id); setEditForm({ nameTh: d.nameTh, type: d.type, value: String(d.value) }); }}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600">✏️</button>
                  <button onClick={() => handleToggle(d)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-medium ${d.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {d.isActive ? "เปิด" : "ปิด"}
                  </button>
                  <button onClick={() => handleDelete(d.id)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-400">🗑</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
