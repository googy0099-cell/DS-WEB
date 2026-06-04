"use client";

import { useState } from "react";
import useSWR from "swr";

type StaffOption = { id: number; name: string };
type Task = {
  id: number;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  deadline: string | null;
  assignee: { user: { firstName: string; lastName: string } } | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  TODO:        { label: "รอดำเนินการ", color: "text-gray-500",   bg: "bg-gray-100" },
  IN_PROGRESS: { label: "กำลังทำ",     color: "text-amber-600",  bg: "bg-amber-50" },
  DONE:        { label: "เสร็จแล้ว",   color: "text-emerald-600", bg: "bg-emerald-50" },
};
const STATUS_ORDER = ["TODO", "IN_PROGRESS", "DONE"] as const;

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function AdminTasksPage() {
  const { data: tasks = [], mutate } = useSWR<Task[]>("/api/hr/tasks", fetcher);
  const { data: staff = [] } = useSWR<StaffOption[]>("/api/hr/staff", fetcher);

  const [filter, setFilter] = useState<"ALL" | "TODO" | "IN_PROGRESS" | "DONE">("ALL");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assignedTo: "", deadline: "" });
  const [saving, setSaving] = useState(false);

  const filtered = filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);
  const counts = { ALL: tasks.length, TODO: 0, IN_PROGRESS: 0, DONE: 0 };
  tasks.forEach((t) => { counts[t.status]++; });

  async function createTask() {
    if (!form.title.trim()) return;
    setSaving(true);
    await fetch("/api/hr/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        assignedTo: form.assignedTo ? Number(form.assignedTo) : null,
        deadline: form.deadline || null,
      }),
    });
    await mutate();
    setForm({ title: "", description: "", assignedTo: "", deadline: "" });
    setModal(false);
    setSaving(false);
  }

  async function updateStatus(task: Task, next: string) {
    await fetch(`/api/hr/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    mutate();
  }

  async function deleteTask(id: number) {
    if (!confirm("ลบงานนี้?")) return;
    await fetch(`/api/hr/tasks/${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">📋 มอบหมายงาน</h1>
          <p className="text-xs text-gray-400 mt-0.5">จัดการงานและมอบหมายให้พนักงาน</p>
        </div>
        <button onClick={() => setModal(true)} className="bg-orange text-white font-bold px-4 py-2 rounded-xl text-sm">
          + มอบหมายงาน
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["ALL", ...STATUS_ORDER] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filter === s ? "bg-orange text-white" : "bg-white text-gray-400 border border-sand"
            }`}
          >
            {s === "ALL" ? "ทั้งหมด" : STATUS_LABELS[s].label} ({counts[s]})
          </button>
        ))}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-12 text-sm">ไม่มีงาน</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((task) => {
            const s = STATUS_LABELS[task.status];
            return (
              <div key={task.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className={`font-semibold text-sm flex-1 text-navy ${task.status === "DONE" ? "line-through text-gray-400" : ""}`}>
                    {task.title}
                  </p>
                  <button onClick={() => deleteTask(task.id)} className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
                </div>
                {task.description && <p className="text-gray-400 text-xs mb-2">{task.description}</p>}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {task.assignee && <span>👤 {task.assignee.user.firstName}</span>}
                    {task.deadline && (
                      <span>· {new Date(task.deadline).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const next = STATUS_ORDER[(STATUS_ORDER.indexOf(task.status as typeof STATUS_ORDER[number]) + 1) % STATUS_ORDER.length];
                      updateStatus(task, next);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium ${s.bg} ${s.color}`}
                  >
                    {s.label}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-navy text-lg">มอบหมายงานใหม่</h3>
            <div className="space-y-3">
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="ชื่องาน *"
                className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="รายละเอียด (ไม่บังคับ)"
                rows={2}
                className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange resize-none"
              />
              <div>
                <label className="text-xs font-semibold text-navy block mb-1">มอบหมายให้</label>
                <select
                  value={form.assignedTo}
                  onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
                  className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
                >
                  <option value="">(ไม่ระบุ)</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-navy block mb-1">กำหนดเสร็จ</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  className="w-full border-2 border-sand rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setModal(false)} className="flex-1 border border-sand text-gray-400 py-3 rounded-2xl text-sm">ยกเลิก</button>
              <button
                onClick={createTask}
                disabled={saving || !form.title.trim()}
                className="flex-1 bg-orange text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-40"
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
