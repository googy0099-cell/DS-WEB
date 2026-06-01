"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import Image from "next/image";
import ImageUpload from "@/components/admin/ImageUpload";
import NumpadInput from "@/components/admin/NumpadInput";

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
  difficulty: string | null;
  isActive: boolean;
  sortOrder: number;
};

const DIFFICULTIES = [
  { value: "easy", label: "ง่าย", color: "text-green-600 bg-green-50" },
  { value: "medium", label: "ปานกลาง", color: "text-yellow-600 bg-yellow-50" },
  { value: "hard", label: "ยาก", color: "text-orange-600 bg-orange-50" },
  { value: "expert", label: "ผู้เชี่ยวชาญ", color: "text-red-600 bg-red-50" },
];

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
  difficulty: "medium",
  isActive: true,
  sortOrder: 0,
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

// ─── Tag Manager Component ────────────────────────────────────────────────────
function TagManager({
  onClose,
  onChanged,
  extraTags,
  setExtraTags,
}: {
  onClose: () => void;
  onChanged: () => void;
  extraTags: string[];
  setExtraTags: (fn: (prev: string[]) => string[]) => void;
}) {
  const { data, mutate } = useSWR<{ tags: { name: string; count: number }[] }>(
    "/api/game-tags",
    fetcher
  );
  const [newTag, setNewTag] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const allTags = data?.tags ?? [];

  async function addTag() {
    const t = newTag.trim();
    if (!t) return;
    setExtraTags((prev) => Array.from(new Set([...prev, t])));
    setNewTag("");
    await mutate();
    onChanged();
  }

  async function deleteTag(tag: string) {
    setBusy(true);
    await fetch("/api/game-tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
    });
    setExtraTags((prev) => prev.filter((t) => t !== tag));
    setConfirmDelete(null);
    await mutate();
    onChanged();
    setBusy(false);
  }

  async function renameTag() {
    if (!editingTag || !editValue.trim() || editValue.trim() === editingTag) {
      setEditingTag(null);
      return;
    }
    setBusy(true);
    await fetch("/api/game-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldTag: editingTag, newTag: editValue.trim() }),
    });
    setExtraTags((prev) => prev.map((t) => (t === editingTag ? editValue.trim() : t)));
    setEditingTag(null);
    await mutate();
    onChanged();
    setBusy(false);
  }

  // Merge server tags + local extraTags not yet used in any game
  const serverTagNames = new Set(allTags.map((t) => t.name));
  const localOnlyTags = extraTags.filter((t) => !serverTagNames.has(t));

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-xl">
        <div className="p-5 border-b border-sand flex justify-between items-center shrink-0">
          <div>
            <h2 className="font-bold text-navy text-lg">🏷️ จัดการประเภทเกม</h2>
            <p className="text-xs text-gray-400 mt-0.5">เพิ่ม / แก้ชื่อ / ลบประเภท</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-1.5">
          {allTags.length === 0 && localOnlyTags.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-6">ยังไม่มีประเภทเกม</p>
          )}

          {allTags.map((t) => (
            <div key={t.name} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
              {editingTag === t.name ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && renameTag()}
                  onBlur={renameTag}
                  className="flex-1 text-sm border border-orange rounded-lg px-2 py-1 outline-none"
                />
              ) : (
                <span className="flex-1 text-sm font-medium text-navy">{t.name}</span>
              )}
              <span className="text-xs text-gray-400 shrink-0">{t.count} เกม</span>
              <button
                onClick={() => { setEditingTag(t.name); setEditValue(t.name); }}
                className="text-xs text-orange hover:underline shrink-0"
                disabled={busy}
              >
                แก้ไข
              </button>
              {confirmDelete === t.name ? (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => deleteTag(t.name)}
                    disabled={busy}
                    className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-lg font-bold"
                  >
                    {busy ? "..." : "ลบ"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="text-xs text-gray-400 px-1"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(t.name)}
                  disabled={busy}
                  className="text-xs text-red-400 hover:text-red-600 shrink-0"
                >
                  ลบ
                </button>
              )}
            </div>
          ))}

          {localOnlyTags.map((t) => (
            <div key={t} className="flex items-center gap-2 bg-orange/5 border border-orange/20 rounded-xl px-3 py-2.5">
              <span className="flex-1 text-sm font-medium text-navy">{t}</span>
              <span className="text-xs text-orange shrink-0">ใหม่ (ยังไม่ใช้)</span>
              <button
                onClick={() => setExtraTags((prev) => prev.filter((x) => x !== t))}
                className="text-xs text-red-400 hover:text-red-600 shrink-0"
              >
                ลบ
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-sand shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              placeholder="ชื่อประเภทใหม่ เช่น วางแผน, ไพ่"
              className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
            />
            <button
              onClick={addTag}
              disabled={!newTag.trim()}
              className="bg-orange text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-40"
            >
              + เพิ่ม
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            ประเภทใหม่จะปรากฏในรายการเมื่อเลือกใส่เกม
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Tag Picker Component ─────────────────────────────────────────────────────
function TagPicker({
  selected,
  allTags,
  onChange,
  onAddTag,
}: {
  selected: string[];
  allTags: string[];
  onChange: (tags: string[]) => void;
  onAddTag: (tag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggle(tag: string) {
    onChange(
      selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]
    );
  }

  function addNew() {
    const t = newTag.trim();
    if (!t) return;
    onAddTag(t);
    if (!selected.includes(t)) onChange([...selected, t]);
    setNewTag("");
  }

  return (
    <div ref={ref} className="relative">
      {/* Selected tags display */}
      <div
        onClick={() => setOpen((v) => !v)}
        className="min-h-[42px] w-full border border-sand rounded-xl px-3 py-2 flex flex-wrap gap-1.5 cursor-pointer hover:border-orange transition-colors"
      >
        {selected.length === 0 && (
          <span className="text-gray-400 text-sm self-center">เลือกหรือเพิ่มแท็ก...</span>
        )}
        {selected.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 bg-navy/10 text-navy text-xs font-medium px-2 py-0.5 rounded-full"
          >
            {tag}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange(selected.filter((t) => t !== tag));
              }}
              className="text-navy/50 hover:text-red-500 leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <span className="ml-auto text-gray-400 text-xs self-center">▾</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-sand rounded-xl shadow-xl overflow-hidden">
          {/* Existing tags */}
          <div className="max-h-44 overflow-y-auto p-2 space-y-0.5">
            {allTags.length === 0 && (
              <p className="text-xs text-gray-400 px-2 py-1">ยังไม่มีแท็ก — เพิ่มด้านล่าง</p>
            )}
            {allTags.map((tag) => (
              <label
                key={tag}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-sand/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(tag)}
                  onChange={() => toggle(tag)}
                  className="accent-orange"
                />
                <span className="text-sm text-navy">{tag}</span>
              </label>
            ))}
          </div>

          {/* Add new tag */}
          <div className="border-t border-sand p-2 flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNew())}
              placeholder="เพิ่มแท็กใหม่..."
              className="flex-1 text-sm border border-sand rounded-lg px-2 py-1.5 focus:border-orange focus:outline-none"
            />
            <button
              onClick={addNew}
              disabled={!newTag.trim()}
              className="bg-orange text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40"
            >
              + เพิ่ม
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminGamesPage() {
  const { data: items = [], mutate } = useSWR<GameGuide[]>("/api/games?all=1", fetcher);
  const [showModal, setShowModal] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [editing, setEditing] = useState<Partial<GameGuide> | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  // Derive all unique tags across every game + a base set
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const allTags = Array.from(
    new Set([
      ...items.flatMap((g) => parseTags(g.tags)),
      ...extraTags,
    ])
  ).sort();

  function openAdd() {
    setEditing({ ...EMPTY });
    setSelectedTags([]);
    setShowModal(true);
  }

  function openEdit(game: GameGuide) {
    setEditing({ ...game });
    setSelectedTags(parseTags(game.tags));
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setSelectedTags([]);
  }

  async function save() {
    if (!editing || !editing.nameTh) return;
    setSaving(true);
    const payload = { ...editing, tags: JSON.stringify(selectedTags) };
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

  async function toggleActive(game: GameGuide) {
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

  const q = search.toLowerCase().trim();
  const filtered = q
    ? items.filter((g) =>
        g.nameTh.toLowerCase().includes(q) ||
        (g.nameEn ?? "").toLowerCase().includes(q) ||
        parseTags(g.tags).some((t) => t.toLowerCase().includes(q))
      )
    : items;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-navy">จัดการบอร์ดเกม</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTagManager(true)}
            className="border border-navy text-navy font-semibold px-3 py-2 rounded-xl text-sm"
          >
            🏷️ ประเภท
          </button>
          <button
            onClick={openAdd}
            className="bg-orange text-white font-semibold px-4 py-2 rounded-xl text-sm"
          >
            + เพิ่มเกม
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อเกม หรือประเภท..."
          className="w-full border border-sand rounded-2xl px-4 py-2.5 pl-9 text-sm focus:outline-none focus:border-orange"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg leading-none">×</button>
        )}
      </div>

      <div className="space-y-3">
        {filtered.map((game) => {
          const tags = parseTags(game.tags);
          return (
            <div key={game.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex gap-4 p-4 items-start">
                <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-sand flex items-center justify-center">
                  {game.imageUrl ? (
                    <Image src={game.imageUrl} alt={game.nameTh} width={80} height={80} className="object-cover w-full h-full" />
                  ) : (
                    <span className="text-3xl">🎲</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-bold text-navy">{game.nameEn || game.nameTh}</span>
                    {game.nameEn && game.nameTh && <span className="text-gray-400 text-xs">{game.nameTh}</span>}
                    <button
                      onClick={() => toggleActive(game)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${game.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                    >
                      {game.isActive ? "แสดง" : "ซ่อน"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">
                    {game.minPlayers}–{game.maxPlayers} คน · {game.durationMin} นาที
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span key={t} className="text-xs bg-sand text-navy px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                  {game.youtubeUrl && (
                    <p className="text-xs text-red-500 truncate mt-1">▶ {game.youtubeUrl}</p>
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
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            {search ? `ไม่พบเกมที่ตรงกับ "${search}"` : "ยังไม่มีเกม"}
          </p>
        )}
      </div>

      {/* Tag Manager */}
      {showTagManager && (
        <TagManager
          onClose={() => setShowTagManager(false)}
          onChanged={() => mutate()}
          extraTags={extraTags}
          setExtraTags={setExtraTags}
        />
      )}

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
              <div>
                <label className="text-xs font-medium text-navy block mb-1">รูปเกม</label>
                <ImageUpload
                  value={editing.imageUrl ?? ""}
                  onChange={(url) => setEditing({ ...editing, imageUrl: url || null })}
                />
              </div>

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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">ผู้เล่นน้อยสุด</label>
                  <NumpadInput
                    value={editing.minPlayers ?? ""}
                    onChange={(v) => setEditing({ ...editing, minPlayers: v || 1 })}
                    placeholder="2"
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">ผู้เล่นมากสุด</label>
                  <NumpadInput
                    value={editing.maxPlayers ?? ""}
                    onChange={(v) => setEditing({ ...editing, maxPlayers: v || 1 })}
                    placeholder="8"
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">เวลา (นาที)</label>
                  <NumpadInput
                    value={editing.durationMin ?? ""}
                    onChange={(v) => setEditing({ ...editing, durationMin: v || 1 })}
                    placeholder="30"
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="text-xs font-medium text-navy block mb-1">ความยาก</label>
                <div className="flex gap-2 flex-wrap">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setEditing({ ...editing, difficulty: d.value })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                        (editing.difficulty ?? "medium") === d.value
                          ? `${d.color} border-current`
                          : "text-gray-400 bg-gray-50 border-transparent"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags — dropdown picker */}
              <div>
                <label className="text-xs font-medium text-navy block mb-1">ประเภทเกม (แท็ก)</label>
                <TagPicker
                  selected={selectedTags}
                  allTags={allTags}
                  onChange={setSelectedTags}
                  onAddTag={(tag) => setExtraTags((prev) => Array.from(new Set([...prev, tag])))}
                />
              </div>

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
                  <NumpadInput
                    value={editing.sortOrder || ""}
                    onChange={(v) => setEditing({ ...editing, sortOrder: v })}
                    placeholder="0"
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
