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

type Block =
  | { type: "heading"; value: string }
  | { type: "text"; value: string }
  | { type: "image"; url: string; caption: string }
  | { type: "button"; url: string; label: string }
  | { type: "highlight"; value: string; color: "orange" | "green" | "blue" }
  | { type: "divider" };

const BLOCK_LABELS: Record<string, string> = {
  heading: "หัวข้อ",
  text: "ข้อความ",
  image: "รูปภาพ",
  button: "ปุ่มลิงก์",
  highlight: "กล่องเน้น",
  divider: "เส้นคั่น",
};

const EMPTY: Omit<Activity, "id"> = {
  emoji: "🎉", title: "", date: "", tag: "", desc: "",
  imageUrl: null, content: null, link: null, linkLabel: null,
  isActive: true, sortOrder: 0,
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function parseBlocks(content: string | null): Block[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as Block[];
  } catch {}
  return [{ type: "text", value: content }];
}

function BlockEditor({ blocks, onChange }: { blocks: Block[]; onChange: (b: Block[]) => void }) {
  function update(i: number, patch: Partial<Block>) {
    const next = blocks.map((b, idx) => idx === i ? ({ ...b, ...patch } as Block) : b);
    onChange(next);
  }
  function move(i: number, dir: -1 | 1) {
    const next = [...blocks];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(i: number) {
    onChange(blocks.filter((_, idx) => idx !== i));
  }
  function add(type: Block["type"]) {
    let newBlock: Block;
    if (type === "heading") newBlock = { type: "heading", value: "" };
    else if (type === "text") newBlock = { type: "text", value: "" };
    else if (type === "image") newBlock = { type: "image", url: "", caption: "" };
    else if (type === "button") newBlock = { type: "button", url: "", label: "ดูรายละเอียด →" };
    else if (type === "highlight") newBlock = { type: "highlight", value: "", color: "orange" };
    else newBlock = { type: "divider" };
    onChange([...blocks, newBlock]);
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <div key={i} className="border border-sand rounded-xl p-3 bg-sand/20 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-navy bg-white px-2 py-0.5 rounded-lg border border-sand">
              {BLOCK_LABELS[block.type]}
            </span>
            <div className="flex gap-1">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs px-2 py-0.5 border border-sand rounded-lg disabled:opacity-30 hover:bg-white">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="text-xs px-2 py-0.5 border border-sand rounded-lg disabled:opacity-30 hover:bg-white">↓</button>
              <button onClick={() => remove(i)} className="text-xs px-2 py-0.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">🗑</button>
            </div>
          </div>

          {block.type === "divider" && (
            <hr className="border-gray-300" />
          )}

          {(block.type === "heading" || block.type === "text") && (
            <textarea
              value={block.value}
              onChange={(e) => update(i, { value: e.target.value } as Partial<Block>)}
              placeholder={block.type === "heading" ? "หัวข้อ..." : "ข้อความ..."}
              rows={block.type === "text" ? 3 : 1}
              className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:border-orange focus:outline-none resize-none bg-white"
            />
          )}

          {block.type === "image" && (
            <div className="space-y-1.5">
              <ImageUpload
                value={(block as Extract<Block, { type: "image" }>).url}
                onChange={(url) => update(i, { url: url || "" } as Partial<Block>)}
              />
              <input
                type="text"
                value={(block as Extract<Block, { type: "image" }>).caption}
                onChange={(e) => update(i, { caption: e.target.value } as Partial<Block>)}
                placeholder="คำบรรยายรูป (ไม่บังคับ)"
                className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:border-orange focus:outline-none bg-white"
              />
            </div>
          )}

          {block.type === "button" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={(block as Extract<Block, { type: "button" }>).url}
                onChange={(e) => update(i, { url: e.target.value } as Partial<Block>)}
                placeholder="URL..."
                className="border border-sand rounded-lg px-3 py-2 text-sm focus:border-orange focus:outline-none bg-white"
              />
              <input
                type="text"
                value={(block as Extract<Block, { type: "button" }>).label}
                onChange={(e) => update(i, { label: e.target.value } as Partial<Block>)}
                placeholder="ชื่อปุ่ม"
                className="border border-sand rounded-lg px-3 py-2 text-sm focus:border-orange focus:outline-none bg-white"
              />
            </div>
          )}

          {block.type === "highlight" && (
            <div className="space-y-1.5">
              <textarea
                value={(block as Extract<Block, { type: "highlight" }>).value}
                onChange={(e) => update(i, { value: e.target.value } as Partial<Block>)}
                placeholder="ข้อความสำคัญ..."
                rows={2}
                className="w-full border border-sand rounded-lg px-3 py-2 text-sm focus:border-orange focus:outline-none resize-none bg-white"
              />
              <div className="flex gap-2">
                {(["orange", "green", "blue"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => update(i, { color: c } as Partial<Block>)}
                    className={`text-xs px-3 py-1 rounded-lg font-medium border-2 transition-all ${
                      (block as Extract<Block, { type: "highlight" }>).color === c
                        ? "border-navy scale-105"
                        : "border-transparent"
                    } ${c === "orange" ? "bg-orange/20 text-orange" : c === "green" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2 pt-1">
        {Object.entries(BLOCK_LABELS).map(([type, label]) => (
          <button
            key={type}
            onClick={() => add(type as Block["type"])}
            className="text-xs border border-orange/40 text-orange px-3 py-1.5 rounded-xl hover:bg-orange/10 transition-colors"
          >
            + {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminActivitiesPage() {
  const { data: items = [], mutate } = useSWR<Activity[]>("/api/activities?all=1", fetcher);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Activity> | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [saving, setSaving] = useState(false);

  function openEdit(item?: Partial<Activity>) {
    const base = item ?? { ...EMPTY };
    setEditing(base);
    setBlocks(parseBlocks(base.content ?? null));
    setShowModal(true);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const contentJson = blocks.length > 0 ? JSON.stringify(blocks) : null;
    const method = editing.id ? "PATCH" : "POST";
    await fetch("/api/activities", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editing, content: contentJson }),
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
          onClick={() => openEdit()}
          className="bg-orange text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          + เพิ่มกิจกรรม
        </button>
      </div>

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
              <button onClick={() => openEdit(item)} className="text-xs text-orange hover:underline">แก้ไข</button>
              <button onClick={() => del(item.id)} className="text-xs text-red-400 hover:underline">ลบ</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-gray-400 py-8">ยังไม่มีกิจกรรม</p>}
      </div>

      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
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
                <label className="text-xs font-medium text-navy block mb-1">รูปแบนเนอร์การ์ด</label>
                <ImageUpload
                  value={(editing as Activity).imageUrl ?? ""}
                  onChange={(url) => setEditing({ ...editing, imageUrl: url || null })}
                />
                <p className="text-xs text-gray-400 mt-1">แนะนำ: 320 × 100 px (แสดงเป็นแบนเนอร์บนการ์ด)</p>
              </div>

              {/* Block editor */}
              <div>
                <label className="text-xs font-medium text-navy block mb-2">เนื้อหาหน้ากิจกรรม (PowerPoint-style)</label>
                <BlockEditor blocks={blocks} onChange={setBlocks} />
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
