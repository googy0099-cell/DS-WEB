"use client";

import { useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Template = {
  id: number; type: string; section: string | null; label: string;
  order: number; requiresPhoto: boolean; isActive: boolean;
};

type ChecklistConfig = {
  id: number; type: string; timeLimitMinutes: number | null; deductionAmount: number;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// ── Drag handle icon ──────────────────────────────────────────────────────────
function GripIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className={className}>
      <circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/>
      <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
      <circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/>
    </svg>
  );
}

// ── Sortable item row ─────────────────────────────────────────────────────────
function SortableItem({
  t, onEdit, onToggle, onDelete,
}: {
  t: Template;
  onEdit: (t: Template) => void;
  onToggle: (t: Template) => void;
  onDelete: (t: Template) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: t.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 px-4 py-3 bg-white ${isDragging ? "shadow-lg z-10 opacity-90" : ""} ${!t.isActive ? "opacity-40" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none shrink-0"
        tabIndex={-1}
      >
        <GripIcon />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy truncate">{t.label}</p>
        <div className="flex gap-1 mt-0.5">
          {t.requiresPhoto && <span className="text-[10px] bg-orange/10 text-orange px-1.5 py-0.5 rounded-full">📷 ถ่ายรูป</span>}
          {!t.isActive && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">ปิดใช้งาน</span>}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={() => onEdit(t)} className="text-xs border border-sand text-navy px-2 py-1 rounded-lg hover:border-navy">แก้ไข</button>
        <button onClick={() => onToggle(t)} className={`text-xs px-2 py-1 rounded-lg border ${t.isActive ? "border-red-200 text-red-400" : "border-green-200 text-green-600"}`}>
          {t.isActive ? "ปิด" : "เปิด"}
        </button>
        <button onClick={() => onDelete(t)} className="text-xs px-2 py-1 rounded-lg border border-red-300 text-red-500">ลบ</button>
      </div>
    </div>
  );
}

// ── Sortable section container ────────────────────────────────────────────────
function SortableSection({
  sectionKey, section, items, sensors,
  editingSection, sectionDraft, sectionInputRef,
  onStartRename, onSaveDraft, onDraftChange, onCancelRename,
  onDeleteSection, onItemDragEnd,
  onEdit, onToggle, onDelete,
}: {
  sectionKey: string;
  section: string | null;
  items: Template[];
  sensors: ReturnType<typeof useSensors>;
  editingSection: string | null;
  sectionDraft: string;
  sectionInputRef: React.RefObject<HTMLInputElement | null>;
  onStartRename: (s: string | null) => void;
  onSaveDraft: () => void;
  onDraftChange: (v: string) => void;
  onCancelRename: () => void;
  onDeleteSection: (s: string | null) => void;
  onItemDragEnd: (e: DragEndEvent, s: string | null) => void;
  onEdit: (t: Template) => void;
  onToggle: (t: Template) => void;
  onDelete: (t: Template) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sectionKey });

  const isEditing = editingSection === sectionKey;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-70" : ""}
    >
      <div className="flex items-center gap-2 mb-2 group">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none shrink-0"
          tabIndex={-1}
        >
          <GripIcon />
        </button>

        {isEditing ? (
          <input
            ref={sectionInputRef}
            value={sectionDraft}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onSaveDraft}
            onKeyDown={(e) => { if (e.key === "Enter") onSaveDraft(); if (e.key === "Escape") onCancelRename(); }}
            className="text-xs font-bold text-orange border-b-2 border-orange bg-transparent outline-none uppercase tracking-wider flex-1 max-w-[200px]"
            autoFocus
          />
        ) : (
          <button
            onClick={() => onStartRename(section)}
            className="text-xs font-bold text-orange uppercase tracking-wider hover:text-orange/70 flex items-center gap-1"
          >
            {section || "(ไม่มีหมวด)"}
            <span className="opacity-0 group-hover:opacity-100 text-[10px] transition-opacity">✏️</span>
          </button>
        )}

        <span className="text-xs text-gray-300">{items.length} รายการ</span>
        <button
          onClick={() => onDeleteSection(section)}
          className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-600 transition-opacity ml-auto"
        >
          ลบหมวด
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => onItemDragEnd(e, section)}
      >
        <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-sand/40">
            {items.map((t) => (
              <SortableItem key={t.id} t={t} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ── Time limit config panel ───────────────────────────────────────────────────
function TimeLimitConfig({
  config, type, saving, onSave,
}: {
  config: ChecklistConfig | null;
  type: string;
  saving: boolean;
  onSave: (type: string, timeLimitMinutes: number | null, deductionAmount: number) => void;
}) {
  const [enabled, setEnabled] = useState(!!config?.timeLimitMinutes);
  const [minutes, setMinutes] = useState(String(config?.timeLimitMinutes ?? 30));
  const [deduction, setDeduction] = useState(String(config?.deductionAmount ?? 0));

  // Sync when config loads
  const prevType = useRef(type);
  if (prevType.current !== type) {
    prevType.current = type;
    setEnabled(!!config?.timeLimitMinutes);
    setMinutes(String(config?.timeLimitMinutes ?? 30));
    setDeduction(String(config?.deductionAmount ?? 0));
  }

  function handleSave() {
    const mins = enabled ? (parseInt(minutes) || null) : null;
    const ded = parseInt(deduction) || 0;
    onSave(type, mins, ded);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-navy text-sm">⏱ ตั้งค่าเวลา{type === "OPEN" ? "เปิดร้าน" : "ปิดร้าน"}</h3>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-xs text-gray-400">{enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span>
          <div
            onClick={() => setEnabled((v) => !v)}
            className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${enabled ? "bg-orange" : "bg-gray-200"}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? "left-5" : "left-1"}`} />
          </div>
        </label>
      </div>

      {enabled && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-navy block mb-1">เวลาจำกัด (นาที)</label>
              <input
                type="number"
                min="1"
                max="480"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
                placeholder="เช่น 30"
              />
            </div>
            {type === "OPEN" && (
              <div className="flex-1">
                <label className="text-xs font-semibold text-navy block mb-1">หักเงิน (บาท)</label>
                <input
                  type="number"
                  min="0"
                  value={deduction}
                  onChange={(e) => setDeduction(e.target.value)}
                  className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
                  placeholder="เช่น 50"
                />
              </div>
            )}
          </div>
          {type === "OPEN" && parseInt(deduction) > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
              ⚠️ หากทำเช็คลิสต์เปิดร้านไม่เสร็จภายใน {minutes} นาที จะหักเงิน {deduction} บาทอัตโนมัติ
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-orange text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50"
      >
        {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminChecklistPage() {
  const { data: templates = [], mutate } = useSWR<Template[]>("/api/hr/checklist/templates", fetcher);
  const { data: configs = [] } = useSWR<ChecklistConfig[]>("/api/hr/checklist/config", fetcher);
  const [tab, setTab] = useState<"OPEN" | "CLOSE">("OPEN");
  const [configSaving, setConfigSaving] = useState(false);

  const [modalItem, setModalItem] = useState<Template | "new" | null>(null);
  const [form, setForm] = useState({ type: "OPEN", section: "", label: "", requiresPhoto: false });
  const [customSectionMode, setCustomSectionMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionDraft, setSectionDraft] = useState("");
  const sectionInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const filtered = templates.filter((t) => t.type === tab).sort((a, b) => a.order - b.order);

  const sectionOrder: (string | null)[] = [];
  const bySection: Record<string, Template[]> = {};
  for (const t of filtered) {
    const key = t.section ?? "";
    if (!bySection[key]) { bySection[key] = []; sectionOrder.push(t.section); }
    bySection[key].push(t);
  }
  const allSections = [...new Set(templates.filter((t) => t.section).map((t) => t.section as string))];

  // ── Bulk save order to API ────────────────────────────────────────────────

  async function saveOrder(updates: { id: number; order: number }[]) {
    await fetch("/api/hr/checklist/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: updates }),
    });
    mutate();
  }

  // ── Section drag ──────────────────────────────────────────────────────────

  async function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sectionOrder.findIndex((s) => (s ?? "") === active.id);
    const newIndex = sectionOrder.findIndex((s) => (s ?? "") === over.id);
    const newOrder = arrayMove(sectionOrder, oldIndex, newIndex);

    // Reassign order values section-by-section
    let counter = 1;
    const updates: { id: number; order: number }[] = [];
    for (const sec of newOrder) {
      for (const item of bySection[sec ?? ""] ?? []) {
        updates.push({ id: item.id, order: counter++ });
      }
    }

    mutate(templates.map((t) => {
      const u = updates.find((x) => x.id === t.id);
      return u ? { ...t, order: u.order } : t;
    }), false);

    await saveOrder(updates);
  }

  // ── Item drag ─────────────────────────────────────────────────────────────

  async function handleItemDragEnd(event: DragEndEvent, section: string | null) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const key = section ?? "";
    const items = bySection[key] ?? [];
    const oldIndex = items.findIndex((t) => t.id === active.id);
    const newIndex = items.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);

    mutate(templates.map((t) => {
      const i = reordered.findIndex((r) => r.id === t.id);
      return i >= 0 ? { ...t, order: items[0].order + i } : t;
    }), false);

    await saveOrder(reordered.map((t, i) => ({ id: t.id, order: i + 1 })));
  }

  // ── Item CRUD ─────────────────────────────────────────────────────────────

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

  // ── Section CRUD ──────────────────────────────────────────────────────────

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

  async function saveConfig(type: string, timeLimitMinutes: number | null, deductionAmount: number) {
    setConfigSaving(true);
    await fetch("/api/hr/checklist/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, timeLimitMinutes, deductionAmount }),
    });
    await globalMutate("/api/hr/checklist/config");
    setConfigSaving(false);
  }

  const currentConfig = configs.find((c) => c.type === tab);

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

      {/* Sections — outer drag */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleSectionDragEnd}
      >
        <SortableContext
          items={sectionOrder.map((s) => s ?? "")}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {sectionOrder.map((section) => (
              <SortableSection
                key={section ?? ""}
                sectionKey={section ?? ""}
                section={section}
                items={bySection[section ?? ""] ?? []}
                sensors={sensors}
                editingSection={editingSection}
                sectionDraft={sectionDraft}
                sectionInputRef={sectionInputRef}
                onStartRename={startRenameSection}
                onSaveDraft={saveRenameSection}
                onDraftChange={setSectionDraft}
                onCancelRename={() => setEditingSection(null)}
                onDeleteSection={deleteSection}
                onItemDragEnd={handleItemDragEnd}
                onEdit={openEdit}
                onToggle={toggleActive}
                onDelete={deleteItem}
              />
            ))}
            {filtered.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">ยังไม่มีรายการ</p>}
          </div>
        </SortableContext>
      </DndContext>

      {/* Time limit config */}
      <TimeLimitConfig
        config={currentConfig ?? null}
        type={tab}
        saving={configSaving}
        onSave={saveConfig}
      />

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
