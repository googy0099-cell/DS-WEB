"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import Image from "next/image";
import ImageUpload from "@/components/admin/ImageUpload";
import NumpadInput from "@/components/admin/NumpadInput";

type MiniGame = {
  id: number;
  name: string;
  description: string | null;
  htmlUrl: string;
  coverUrl: string | null;
  isActive: boolean;
  sortOrder: number;
};

type EditingGame = Partial<MiniGame>;

const EMPTY: EditingGame = {
  name: "", description: null, htmlUrl: "", coverUrl: null,
  isActive: true, sortOrder: 0,
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminMiniGamesPage() {
  const { data: games = [], mutate } = useSWR<MiniGame[]>("/api/mini-games?all=1", fetcher);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EditingGame | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const htmlInputRef = useRef<HTMLInputElement>(null);

  function openAdd() { setEditing({ ...EMPTY }); setUploadError(""); setShowModal(true); }
  function openEdit(g: MiniGame) { setEditing({ ...g }); setUploadError(""); setShowModal(true); }

  async function uploadHtml(file: File) {
    setUploading(true); setUploadError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload-html", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { setUploadError(data.error ?? "อัปโหลดไม่สำเร็จ"); return null; }
    return data.url as string;
  }

  async function save() {
    if (!editing?.name || !editing?.htmlUrl) return;
    setSaving(true);
    const method = editing.id ? "PATCH" : "POST";
    await fetch("/api/mini-games", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    await mutate();
    setShowModal(false);
    setSaving(false);
  }

  async function toggleActive(g: MiniGame) {
    await fetch("/api/mini-games", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: g.id, isActive: !g.isActive }),
    });
    mutate();
  }

  async function deleteGame(id: number) {
    if (!confirm("ลบมินิเกมนี้?")) return;
    await fetch("/api/mini-games", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-navy">มินิเกม (HTML)</h1>
        <button onClick={openAdd} className="bg-orange text-white font-semibold px-4 py-2 rounded-xl text-sm">
          + เพิ่มมินิเกม
        </button>
      </div>

      {games.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 shadow-sm">
          <p className="text-4xl mb-3">🎮</p>
          <p>ยังไม่มีมินิเกม</p>
          <p className="text-sm mt-1">กด "+ เพิ่มมินิเกม" เพื่ออัปโหลดไฟล์ HTML</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((g) => (
            <div key={g.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden ${!g.isActive ? "opacity-50" : ""}`}>
              <div className="relative aspect-video bg-sand flex items-center justify-center">
                {g.coverUrl ? (
                  <Image src={g.coverUrl} alt={g.name} fill className="object-cover" />
                ) : (
                  <span className="text-5xl">🎮</span>
                )}
              </div>
              <div className="p-4">
                <p className="font-bold text-navy">{g.name}</p>
                {g.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{g.description}</p>}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => toggleActive(g)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${g.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                  >
                    {g.isActive ? "เปิด" : "ปิด"}
                  </button>
                  <a href={g.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                    เปิดไฟล์
                  </a>
                  <button onClick={() => openEdit(g)} className="text-xs text-orange hover:underline ml-auto">แก้ไข</button>
                  <button onClick={() => deleteGame(g.id)} className="text-xs text-red-400 hover:underline">ลบ</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <h2 className="font-bold text-navy text-lg mb-4">
              {editing.id ? "แก้ไขมินิเกม" : "เพิ่มมินิเกมใหม่"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-navy block mb-1">ชื่อเกม *</label>
                <input
                  type="text"
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="เช่น เกมจับคู่ไพ่"
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-navy block mb-1">คำอธิบาย</label>
                <input
                  type="text"
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value || null })}
                  placeholder="อธิบายสั้นๆ"
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-navy block mb-1">ไฟล์เกม (.html) *</label>
                <input
                  ref={htmlInputRef}
                  type="file"
                  accept=".html,text/html"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = await uploadHtml(f);
                    if (url) setEditing({ ...editing, htmlUrl: url });
                    e.target.value = "";
                  }}
                />
                {editing.htmlUrl ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <span className="text-green-600 text-sm flex-1 truncate">✅ อัปโหลดแล้ว</span>
                    <button onClick={() => htmlInputRef.current?.click()} className="text-xs text-orange shrink-0">เปลี่ยน</button>
                  </div>
                ) : (
                  <button
                    onClick={() => htmlInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full border-2 border-dashed border-sand rounded-xl py-4 text-sm text-gray-400 hover:border-orange hover:text-orange transition-colors disabled:opacity-50"
                  >
                    {uploading ? "กำลังอัปโหลด..." : "📁 เลือกไฟล์ .html"}
                  </button>
                )}
                {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-navy block mb-1">รูปปก</label>
                <ImageUpload
                  value={editing.coverUrl ?? ""}
                  onChange={(url) => setEditing({ ...editing, coverUrl: url || null })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-navy block mb-1">ลำดับการแสดง</label>
                <NumpadInput
                  value={editing.sortOrder || ""}
                  onChange={(v) => setEditing({ ...editing, sortOrder: v })}
                  placeholder="0"
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.isActive ?? true}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                />
                เปิดให้เล่น
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-sand text-navy font-semibold py-2.5 rounded-xl text-sm">ยกเลิก</button>
              <button
                onClick={save}
                disabled={saving || !editing?.name || !editing?.htmlUrl || uploading}
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
