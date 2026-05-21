"use client";

import { useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import ImageUpload from "@/components/admin/ImageUpload";

type GalleryItem = {
  id: number;
  imageUrl: string;
  caption: string | null;
  section: string;
  sortOrder: number;
  isActive: boolean;
};

const SECTIONS: { value: string; label: string; desc: string; color: string }[] = [
  { value: "gallery", label: "แกลเลอรี่หน้าแรก", desc: "แสดงในส่วน 'บรรยากาศร้าน' บนหน้าแรก", color: "bg-blue-100 text-blue-700" },
  { value: "hero",    label: "สไลด์โชว์หน้าแรก", desc: "แสดงเป็นสไลด์ Hero ด้านบนสุดของหน้าแรก", color: "bg-purple-100 text-purple-700" },
  { value: "about",   label: "ส่วนเกี่ยวกับเรา",  desc: "แสดงในส่วน 'เกี่ยวกับเรา' บนหน้าแรก",  color: "bg-green-100 text-green-700" },
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminGalleryPage() {
  const { data: items = [], mutate } = useSWR<GalleryItem[]>("/api/gallery?all=1", fetcher);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partial<GalleryItem> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterSection, setFilterSection] = useState("all");

  async function save() {
    if (!editing) return;
    setSaving(true);
    const method = editing.id ? "PATCH" : "POST";
    await fetch("/api/gallery", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "gallery", ...editing }),
    });
    await mutate();
    setShowModal(false);
    setSaving(false);
  }

  async function toggle(item: GalleryItem) {
    await fetch("/api/gallery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
    });
    mutate();
  }

  async function del(id: number) {
    if (!confirm("ลบรูปนี้?")) return;
    await fetch("/api/gallery", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
  }

  const sectionInfo = (val: string) => SECTIONS.find((s) => s.value === val) ?? SECTIONS[0];

  const displayed = filterSection === "all" ? items : items.filter((i) => i.section === filterSection);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-navy">จัดการรูปภาพ</h1>
        <button
          onClick={() => {
            setEditing({ imageUrl: "", caption: "", section: "gallery", sortOrder: 0, isActive: true });
            setShowModal(true);
          }}
          className="bg-orange text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          + อัปโหลดรูป
        </button>
      </div>

      {/* Section filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFilterSection("all")}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${filterSection === "all" ? "bg-navy text-cream border-navy" : "bg-white text-navy border-sand"}`}
        >
          ทั้งหมด ({items.length})
        </button>
        {SECTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilterSection(s.value)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${filterSection === s.value ? "bg-navy text-cream border-navy" : "bg-white text-navy border-sand"}`}
          >
            {s.label} ({items.filter((i) => i.section === s.value).length})
          </button>
        ))}
      </div>

      {/* Section info banner */}
      {filterSection !== "all" && (
        <div className="mb-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 flex items-center gap-2">
          <span>📍</span>
          <span>{sectionInfo(filterSection).desc} — <a href={filterSection === "gallery" || filterSection === "hero" || filterSection === "about" ? "/#" + filterSection : "/"} target="_blank" className="font-bold underline">ดูบนเว็บ →</a></span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {displayed.map((item) => {
          const sec = sectionInfo(item.section);
          return (
            <div key={item.id} className={`bg-white rounded-2xl overflow-hidden shadow-sm border-2 ${item.isActive ? "border-green-200" : "border-gray-200"}`}>
              <div className="relative aspect-[4/3]">
                <Image
                  src={item.imageUrl}
                  alt={item.caption ?? ""}
                  fill
                  className={`object-cover ${!item.isActive ? "opacity-40" : ""}`}
                />
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${item.isActive ? "bg-green-500 text-white" : "bg-gray-500 text-white"}`}>
                    {item.isActive ? "แสดงอยู่ ✓" : "ซ่อนอยู่"}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${sec.color}`}>
                    {sec.label}
                  </span>
                </div>
              </div>
              <div className="p-3">
                {item.caption && <p className="text-xs text-navy font-medium mb-2 truncate">{item.caption}</p>}
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => toggle(item)}
                    className={`text-xs px-2 py-1 rounded-lg flex-1 font-medium border transition-colors ${item.isActive ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-700 hover:bg-green-50"}`}
                  >
                    {item.isActive ? "ซ่อน" : "แสดง"}
                  </button>
                  <button onClick={() => { setEditing({ ...item }); setShowModal(true); }} className="text-xs text-orange hover:underline">แก้ไข</button>
                  <button onClick={() => del(item.id)} className="text-xs text-red-400 hover:underline">ลบ</button>
                </div>
              </div>
            </div>
          );
        })}
        {displayed.length === 0 && (
          <div className="col-span-3 text-center text-gray-400 py-12">
            {filterSection === "all" ? "ยังไม่มีรูปภาพ" : `ยังไม่มีรูปในส่วน "${sectionInfo(filterSection).label}"`}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && editing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-bold text-navy text-lg mb-4">{editing.id ? "แก้ไขรูป" : "เพิ่มรูป"}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-navy block mb-1">รูปภาพ *</label>
                <ImageUpload
                  value={editing.imageUrl ?? ""}
                  onChange={(url) => setEditing({ ...editing, imageUrl: url })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-navy block mb-1">จะแสดงที่ส่วนไหน *</label>
                <div className="space-y-2">
                  {SECTIONS.map((s) => (
                    <label
                      key={s.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${editing.section === s.value ? "border-orange bg-orange/5" : "border-sand hover:border-orange/40"}`}
                    >
                      <input
                        type="radio"
                        name="section"
                        value={s.value}
                        checked={editing.section === s.value}
                        onChange={() => setEditing({ ...editing, section: s.value })}
                        className="mt-0.5 accent-orange"
                      />
                      <div>
                        <p className="text-sm font-semibold text-navy">{s.label}</p>
                        <p className="text-xs text-gray-500">{s.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-navy block mb-1">คำบรรยาย (ไม่บังคับ)</label>
                <input
                  type="text"
                  value={editing.caption ?? ""}
                  onChange={(e) => setEditing({ ...editing, caption: e.target.value })}
                  placeholder="เช่น บรรยากาศในร้าน"
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-sand text-navy font-semibold py-2.5 rounded-xl text-sm">ยกเลิก</button>
              <button
                onClick={save}
                disabled={saving || !editing.imageUrl || !editing.section}
                className="flex-1 bg-orange text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? "..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
