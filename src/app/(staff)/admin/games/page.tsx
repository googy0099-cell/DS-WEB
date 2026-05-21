"use client";

import { useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import ImageUpload from "@/components/admin/ImageUpload";

type GameGuide = {
  id: number;
  nameTh: string;
  nameEn: string;
  summaryTh: string;
  youtubeUrl: string | null;
  imageUrl: string | null;
  minPlayers: number;
  maxPlayers: number;
  durationMin: number;
  tags: string;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY: Omit<GameGuide, "id"> = {
  nameTh: "",
  nameEn: "",
  summaryTh: "",
  youtubeUrl: "",
  imageUrl: null,
  minPlayers: 2,
  maxPlayers: 8,
  durationMin: 30,
  tags: "[]",
  isActive: true,
  sortOrder: 0,
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminGamesPage() {
  const { data: items = [], mutate } = useSWR<GameGuide[]>("/api/games?all=1", fetcher);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partial<GameGuide> | null>(null);
  const [saving, setSaving] = useState(false);
  const [tagsInput, setTagsInput] = useState("");

  function openAdd() {
    setEditing({ ...EMPTY });
    setTagsInput("");
    setShowModal(true);
  }

  function openEdit(game: GameGuide) {
    setEditing({ ...game });
    try {
      setTagsInput(JSON.parse(game.tags).join(", "));
    } catch {
      setTagsInput("");
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setTagsInput("");
  }

  async function save() {
    if (!editing || !editing.nameTh) return;
    setSaving(true);
    const tagsArray = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = { ...editing, tags: JSON.stringify(tagsArray) };
    const method = editing.id ? "PATCH" : "POST";
    await fetch("/api/games", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await mutate();
    closeModal();
    setSaving(false);
  }

  async function toggle(game: GameGuide) {
    await fetch("/api/games", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: game.id, isActive: !game.isActive }),
    });
    mutate();
  }

  async function del(id: number) {
    if (!confirm("ลบเกมนี้?")) return;
    await fetch("/api/games", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-navy">จัดการบอร์ดเกม</h1>
        <button
          onClick={openAdd}
          className="bg-orange text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          + เพิ่มเกม
        </button>
      </div>

      <div className="space-y-3">
        {items.map((game) => {
          let tags: string[] = [];
          try { tags = JSON.parse(game.tags); } catch { /* empty */ }

          return (
            <div key={game.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex gap-4 p-4 items-start">
                {/* Image */}
                <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-sand flex items-center justify-center">
                  {game.imageUrl ? (
                    <Image src={game.imageUrl} alt={game.nameTh} width={80} height={80} className="object-cover w-full h-full" />
                  ) : (
                    <span className="text-3xl">🎲</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-bold text-navy">{game.nameTh}</span>
                    {game.nameEn && <span className="text-gray-400 text-xs">{game.nameEn}</span>}
                    <button
                      onClick={() => toggle(game)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${game.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                    >
                      {game.isActive ? "แสดง" : "ซ่อน"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">
                    {game.minPlayers}–{game.maxPlayers} คน · {game.durationMin} นาที
                  </p>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {tags.map((t) => (
                      <span key={t} className="text-xs bg-sand text-navy px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                  {game.youtubeUrl && (
                    <p className="text-xs text-red-500 truncate">▶ {game.youtubeUrl}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => openEdit(game)} className="text-xs text-orange hover:underline">แก้ไข</button>
                  <button onClick={() => del(game.id)} className="text-xs text-red-400 hover:underline">ลบ</button>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-center text-gray-400 py-8">ยังไม่มีเกม</p>}
      </div>

      {/* Modal */}
      {showModal && editing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <h2 className="font-bold text-navy text-lg mb-4">
              {editing.id ? "แก้ไขเกม" : "เพิ่มเกมใหม่"}
            </h2>

            <div className="space-y-3">
              {/* Image */}
              <div>
                <label className="text-xs font-medium text-navy block mb-1">รูปเกม</label>
                <ImageUpload
                  value={editing.imageUrl ?? ""}
                  onChange={(url) => setEditing({ ...editing, imageUrl: url || null })}
                />
              </div>

              {/* Names */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">ชื่อ (ไทย) *</label>
                  <input
                    type="text"
                    value={editing.nameTh ?? ""}
                    onChange={(e) => setEditing({ ...editing, nameTh: e.target.value })}
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                    placeholder="มาเฟีย"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">ชื่อ (อังกฤษ)</label>
                  <input
                    type="text"
                    value={editing.nameEn ?? ""}
                    onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })}
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                    placeholder="Mafia"
                  />
                </div>
              </div>

              {/* Players / Duration */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">ผู้เล่นน้อยสุด</label>
                  <input
                    type="number"
                    min={1}
                    value={editing.minPlayers ?? 2}
                    onChange={(e) => setEditing({ ...editing, minPlayers: Number(e.target.value) })}
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">ผู้เล่นมากสุด</label>
                  <input
                    type="number"
                    min={1}
                    value={editing.maxPlayers ?? 8}
                    onChange={(e) => setEditing({ ...editing, maxPlayers: Number(e.target.value) })}
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">เวลา (นาที)</label>
                  <input
                    type="number"
                    min={1}
                    value={editing.durationMin ?? 30}
                    onChange={(e) => setEditing({ ...editing, durationMin: Number(e.target.value) })}
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs font-medium text-navy block mb-1">
                  แท็ก <span className="text-gray-400 font-normal">(คั่นด้วยจุลภาค เช่น บลัฟฟิ่ง, ทีม)</span>
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  placeholder="บลัฟฟิ่ง, ทีม, เล่นเร็ว"
                />
              </div>

              {/* YouTube */}
              <div>
                <label className="text-xs font-medium text-navy block mb-1">
                  ลิงก์คลิปสอนเกม (YouTube)
                </label>
                <input
                  type="url"
                  value={editing.youtubeUrl ?? ""}
                  onChange={(e) => setEditing({ ...editing, youtubeUrl: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>

              {/* Summary */}
              <div>
                <label className="text-xs font-medium text-navy block mb-1">วิธีเล่น / รายละเอียด</label>
                <textarea
                  value={editing.summaryTh ?? ""}
                  onChange={(e) => setEditing({ ...editing, summaryTh: e.target.value })}
                  rows={4}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none resize-none"
                  placeholder="อธิบายวิธีเล่นโดยย่อ..."
                />
              </div>

              {/* Sort order + isActive */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.isActive ?? true}
                    onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  />
                  แสดงบนเว็บไซต์
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400">ลำดับ</label>
                  <input
                    type="number"
                    value={editing.sortOrder ?? 0}
                    onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
                    className="w-16 border border-sand rounded-lg px-2 py-1 text-sm text-center focus:border-orange focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
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
