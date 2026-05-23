"use client";

import { useState } from "react";
import useSWR from "swr";
import ImageUpload from "@/components/admin/ImageUpload";

type Activity = {
  id: number;
  emoji: string;
  title: string;
  date: string;
  tag: string;
  desc: string;
  imageUrl: string | null;
  content: string | null;
  link: string | null;
  linkLabel: string | null;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY: Omit<Activity, "id"> = {
  emoji: "🎉", title: "", date: "", tag: "", desc: "",
  imageUrl: null, content: null, link: null, linkLabel: null,
  isActive: true, sortOrder: 0,
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminActivitiesPage() {
  const { data: items = [], mutate } = useSWR<Activity[]>("/api/activities?all=1", fetcher);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Activity> | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!editing) return;
    setSaving(true);
    const method = editing.id ? "PATCH" : "POST";
    await fetch("/api/activities", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    await mutate();
    setShowModal(false);
    setSaving(false);
  }

  async function toggle(item: Activity) {
    await fetch("/api/activities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
    });
    mutate();
  }

  async function del(id: number) {
    if (!confirm("ลบกิจกรรมนี้?")) return;
    await fetch("/api/activities", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-navy">จัดการกิจกรรม</h1>
        <button
          onClick={() => { setEditing({ ...EMPTY }); setShowModal(true); }}
          className="bg-orange text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          + เพิ่มกิจกรรม
        </button>
      </div>

      {/* คำอธิบาย */}
      <div className="mb-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
        กิจกรรมจะแสดงที่ <a href="/activities" target="_blank" className="font-bold underline">หน้ากิจกรรม (/activities)</a> และ <a href="/#activities" target="_blank" className="font-bold underline">หน้าแรก → ส่วนกิจกรรม</a>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className={`bg-white rounded-2xl p-4 shadow-sm flex gap-4 items-start border-l-4 ${item.isActive ? "border-green-400" : "border-gray-200 opacity-60"}`}>
            <span className="text-3xl">{item.emoji}</span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-bold text-navy">{item.title}</span>
                <span className="text-xs bg-orange/10 text-orange px-2 py-0.5 rounded-full">{item.tag}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {item.isActive ? "กำลังแสดง ✓" : "ซ่อนอยู่"}
                </span>
              </div>
              <p className="text-orange text-xs font-semibold mb-1">{item.date}</p>
              <p className="text-gray-500 text-sm">{item.desc}</p>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => toggle(item)}
                className={`text-xs px-2 py-1 rounded-lg border font-medium ${item.isActive ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-700 hover:bg-green-50"}`}
              >
                {item.isActive ? "ซ่อน" : "แสดง"}
              </button>
              <button onClick={() => { setEditing({ ...item }); setShowModal(true); }} className="text-xs text-orange hover:underline">แก้ไข</button>
              <button onClick={() => del(item.id)} className="text-xs text-red-400 hover:underline">ลบ</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-gray-400 py-8">ยังไม่มีกิจกรรม</p>}
      </div>

      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <h2 className="font-bold text-navy text-lg mb-4">{editing.id ? "แก้ไข" : "เพิ่ม"}กิจกรรม</h2>
            <div className="space-y-3">
              {[
                { label: "Emoji", field: "emoji", placeholder: "🎉" },
                { label: "ชื่อกิจกรรม *", field: "title", placeholder: "Tournament ประจำเดือน" },
                { label: "วัน/เวลา", field: "date", placeholder: "ทุกสิ้นเดือน เวลา 18:00 น." },
                { label: "Tag", field: "tag", placeholder: "การแข่งขัน" },
                { label: "คำอธิบายสั้น", field: "desc", placeholder: "สรุปสั้นๆ ที่เห็นในหน้า list" },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="text-xs font-medium text-navy block mb-1">{label}</label>
                  <input
                    type="text"
                    value={(editing as Record<string, string>)[field] ?? ""}
                    onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
              ))}

              <div>
                <label className="text-xs font-medium text-navy block mb-1">รูปหน้าปก</label>
                <ImageUpload
                  value={(editing as Activity).imageUrl ?? ""}
                  onChange={(url) => setEditing({ ...editing, imageUrl: url || null })}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-navy block mb-1">เนื้อหาเพิ่มเติม (แสดงในหน้า detail)</label>
                <textarea
                  value={(editing as Activity).content ?? ""}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value || null })}
                  placeholder="รายละเอียดเต็มๆ กติกา เงื่อนไข ฯลฯ"
                  rows={5}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">ลิงก์ (URL)</label>
                  <input
                    type="text"
                    value={(editing as Activity).link ?? ""}
                    onChange={(e) => setEditing({ ...editing, link: e.target.value || null })}
                    placeholder="https://..."
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">ชื่อปุ่มลิงก์</label>
                  <input
                    type="text"
                    value={(editing as Activity).linkLabel ?? ""}
                    onChange={(e) => setEditing({ ...editing, linkLabel: e.target.value || null })}
                    placeholder="สมัครเข้าร่วม →"
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-sand text-navy font-semibold py-2.5 rounded-xl text-sm">ยกเลิก</button>
              <button onClick={save} disabled={saving || !editing.title} className="flex-1 bg-orange text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
