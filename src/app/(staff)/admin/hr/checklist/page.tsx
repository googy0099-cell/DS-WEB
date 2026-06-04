"use client";

import { useRef, useState } from "react";
import useSWR from "swr";

type Template = {
  id: number; type: string; section: string | null; label: string;
  order: number; requiresPhoto: boolean; isActive: boolean;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function AdminChecklistPage() {
  const { data: templates = [], mutate } = useSWR<Template[]>("/api/hr/checklist/templates", fetcher);
  const [tab, setTab] = useState<"OPEN" | "CLOSE">("OPEN");

  // Add/edit item modal
  const [modalItem, setModalItem] = useState<Template | "new" | null>(null);
  const [form, setForm] = useState({ type: "OPEN", section: "", label: "", requiresPhoto: false });
  const [customSectionMode, setCustomSectionMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Inline section rename
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionDraft, setSectionDraft] = useState("");
  const sectionInputRef = useRef<HTMLInputElement>(null);

  const filtered = templates.filter((t) => t.type === tab).sort((a, b) => a.order - b.order);

  // Unique sections in order of first appearance
  const sectionOrder: (string | null)[] = [];
  const bySection: Record<string, Template[]> = {};
  for (const t of filtered) {
    const key = t.section ?? "";
    if (!bySection[key]) { bySection[key] = []; sectionOrder.push(t.section); }
    bySection[key].push(t);
  }
  // All section names (for datalist)
  const allSections = [...new Set(templates.filter((t) => t.section).map((t) => t.section as string))];

  // ── Item CRUD ──────────────────────────────────────────────────────────────

  function openAdd() {
    setCustomSectionMode(false);
    setForm({ type: tab, section: "", label: "", requiresPhoto: false });
    setModalItem("new");
  }
  function openEdit(t: Template) {
    const isKnown = allSections.includes(t.section ?? "");
    setCustomSectionMode(!!t.section && !isKnown);
    setForm({ type: t.type, section: t.section ?? "", label: t.label, requiresPhoto: t.requiresPhoto });
    setModalItem(t);
  }

  async function saveItem() {
    setSaving(true);
    if (modalItem && modalItem !== "new") {
      await fetch("/api/hr/checklist/templates", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: (modalItem as Template).id, ...form, section: form.section || null }),
      });
    } else {
      await fetch("/api/hr/checklist/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, section: form.section || null }),
      });
    }
    await mutate(); setSaving(false); setModalItem(null);
  }

  async function toggleActive(t: Template) {
    await fetch("/api/hr/checklist/templates", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, isActive: !t.isActive }),
    });
    mutate();
  }

  async function deleteItem(t: Template) {
    if (!confirm(`ลบ "${t.label}"?`)) return;
    await fetch(`/api/hr/checklist/templates?id=${t.id}`, { method: "DELETE" });
    mutate();
  }

  // ── Section CRUD ───────────────────────────────────────────────────────────

  function startRenameSection(section: string | null) {
    setEditingSection(section ?? "");
    setSectionDraft(section ?? "");
    setTimeout(() => sectionInputRef.current?.select(), 50);
  }

  async function saveRenameSection() {
    const oldSection = editingSection === "" ? null : editingSection;
    const newSection = sectionDraft.trim() || null;
    if (newSection === oldSection) { setEditingSection(null); return; }
    await fetch("/api/hr/checklist/templates", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: tab, oldSection, newSection }),
    });
    await mutate();
    setEditingSection(null);
  }

  async function deleteSection(section: string | null) {
    const label = section || "(ไม่มีหมวด)";
    const count = bySection[section ?? ""]?.length ?? 0;
    if (!confirm(`ลบหมวด "${label}" และรายการทั้งหมด ${count} รายการ?`)) return;
    await fetch(`/api/hr/checklist/templates?type=${tab}&section=${encodeURIComponent(section ?? "")}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">✅ จัดการเช็คลิสต์</h1>
          <p className="text-xs text-gray-400 mt-0.5">รายการเช็คลิสต์เปิด/ปิดร้านประจำวัน</p>
        </div>
        <button onClick={openAdd} className="bg-orange text-white font-bold px-4 py-2 rounded-xl text-sm">
          + เพิ่มรายการ
        </button>
      </div>

      {/* Tab */}
      <div className="flex gap-2 bg-sand/30 rounded-2xl p-1">
        {(["OPEN","CLOSE"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === t ? "bg-white text-navy shadow-sm" : "text-gray-400"}`}>
            {t === "OPEN" ? "🌅 เปิดร้าน" : "🌙 ปิดร้าน"}
          </button>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sectionOrder.map((section) => {
          const key = section ?? "";
          const items = bySection[key] ?? [];
          const isEditing = editingSection === key;

          return (
            <div key={key}>
              {/* Section header — editable */}
              <div className="flex items-center gap-2 mb-2 group">
                {isEditing ? (
                  <input
                    ref={sectionInputRef}
                    value={sectionDraft}
                    onChange={(e) => setSectionDraft(e.target.value)}
                    onBlur={saveRenameSection}
                    onKeyDown={(e) => { if (e.key === "Enter") saveRenameSection(); if (e.key === "Escape") setEditingSection(null); }}
                    className="text-xs font-bold text-orange border-b-2 border-orange bg-transparent outline-none uppercase tracking-wider flex-1 max-w-[200px]"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => startRenameSection(section)}
                    className="text-xs font-bold text-orange uppercase tracking-wider hover:text-orange/70 flex items-center gap-1"
                  >
                    {section || "(ไม่มีหมวด)"}
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] transition-opacity">✏️</span>
                  </button>
                )}
                <span className="text-xs text-gray-300">{items.length} รายการ</span>
                <button
                  onClick={() => deleteSection(section)}
                  className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-600 transition-opacity ml-auto"
                >
                  ลบหมวด
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-sand/40">
                {items.map((t) => (
                  <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${!t.isActive ? "opacity-40" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{t.label}</p>
                      <div className="flex gap-1 mt-0.5">
                        {t.requiresPhoto && <span className="text-[10px] bg-orange/10 text-orange px-1.5 py-0.5 rounded-full">📷 ถ่ายรูป</span>}
                        {!t.isActive && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">ปิดใช้งาน</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(t)} className="text-xs border border-sand text-navy px-2 py-1 rounded-lg hover:border-navy">แก้ไข</button>
                      <button onClick={() => toggleActive(t)} className={`text-xs px-2 py-1 rounded-lg border ${t.isActive ? "border-red-200 text-red-400" : "border-green-200 text-green-600"}`}>
                        {t.isActive ? "ปิด" : "เปิด"}
                      </button>
                      <button onClick={() => deleteItem(t)} className="text-xs px-2 py-1 rounded-lg border border-red-300 text-red-500">ลบ</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">ยังไม่มีรายการ</p>}
      </div>

      {/* Note */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-700">
        <p className="font-semibold mb-1">⚠️ หมายเหตุ</p>
        <p>การแก้ไขจะมีผลกับเช็คลิสต์วันถัดไปเท่านั้น เช็คลิสต์วันนี้ที่สร้างไปแล้วจะไม่เปลี่ยนแปลง</p>
      </div>

      {/* Add/Edit modal */}
      {modalItem !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-navy text-lg">{modalItem === "new" ? "เพิ่มรายการ" : "แก้ไขรายการ"}</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-navy block mb-1">ประเภท</label>
                <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange">
                  <option value="OPEN">🌅 เปิดร้าน</option>
                  <option value="CLOSE">🌙 ปิดร้าน</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-navy block mb-1">หมวด</label>
                <select
                  value={customSectionMode ? "__custom__" : (form.section || "")}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setCustomSectionMode(true);
                      setForm((p) => ({ ...p, section: "" }));
                    } else {
                      setCustomSectionMode(false);
                      setForm((p) => ({ ...p, section: e.target.value }));
                    }
                  }}
                  className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
                >
                  <option value="">(ไม่มีหมวด)</option>
                  {allSections.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value="__custom__">+ เพิ่มหมวดใหม่...</option>
                </select>
                {customSectionMode && (
                  <input
                    value={form.section}
                    onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))}
                    placeholder="ชื่อหมวดใหม่"
                    className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange mt-2"
                    autoFocus
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-navy block mb-1">รายการ *</label>
                <input value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                  placeholder="เช่น เปิดไฟร้าน"
                  className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={form.requiresPhoto}
                  onChange={(e) => setForm((p) => ({ ...p, requiresPhoto: e.target.checked }))}
                  className="accent-orange w-4 h-4" />
                <span className="text-navy font-medium">ต้องถ่ายรูปประกอบ 📷</span>
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setModalItem(null)} className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm">ยกเลิก</button>
              <button onClick={saveItem} disabled={saving || !form.label.trim()}
                className="flex-1 bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40">
                {saving ? "..." : modalItem === "new" ? "เพิ่ม" : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
