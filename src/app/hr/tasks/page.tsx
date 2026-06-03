"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import HrNav from "@/components/hr/HrNav";

type Task = {
  id: number;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  deadline: string | null;
  assignee: { user: { firstName: string; lastName: string } } | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TODO: { label: "รอดำเนินการ", color: "text-[#f8f1e5]/50" },
  IN_PROGRESS: { label: "กำลังทำ", color: "text-amber-400" },
  DONE: { label: "เสร็จแล้ว", color: "text-emerald-400" },
};

const STATUS_ORDER = ["TODO", "IN_PROGRESS", "DONE"];

export default function TasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string })?.role;
  const canCreate = ["CASHIER", "OWNER"].includes(role ?? "");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", deadline: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/api/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/hr/tasks").then((r) => r.json()).then(setTasks).catch(() => {});
  }, [status]);

  async function updateStatus(task: Task, newStatus: string) {
    const updated = await fetch(`/api/hr/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).then((r) => r.json());
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
  }

  async function createTask() {
    if (!form.title.trim()) return;
    setSaving(true);
    const task = await fetch("/api/hr/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title, description: form.description || null, deadline: form.deadline || null }),
    }).then((r) => r.json());
    setTasks((prev) => [task, ...prev]);
    setForm({ title: "", description: "", deadline: "" });
    setShowForm(false);
    setSaving(false);
  }

  async function deleteTask(id: number) {
    await fetch(`/api/hr/tasks/${id}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const filtered = filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);
  const counts = { ALL: tasks.length, TODO: 0, IN_PROGRESS: 0, DONE: 0 };
  tasks.forEach((t) => { counts[t.status as keyof typeof counts]++; });

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center text-[#f8f1e5]/40 text-sm">กำลังโหลด...</div>;

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold">งาน</h1>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#fb8500] text-white text-sm font-bold px-4 py-2 rounded-xl"
          >
            + มอบหมายงาน
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {(["ALL", ...STATUS_ORDER] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filter === s ? "bg-[#fb8500] text-white" : "bg-white/5 text-[#f8f1e5]/50"
            }`}
          >
            {s === "ALL" ? "ทั้งหมด" : STATUS_LABELS[s].label} ({counts[s as keyof typeof counts]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-[#f8f1e5]/30 text-sm py-16">ไม่มีงาน</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((task) => (
            <div key={task.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className={`font-semibold text-sm flex-1 ${task.status === "DONE" ? "line-through text-[#f8f1e5]/40" : ""}`}>
                  {task.title}
                </p>
                {canCreate && (
                  <button onClick={() => deleteTask(task.id)} className="text-[#f8f1e5]/20 text-xs hover:text-red-400">
                    ✕
                  </button>
                )}
              </div>
              {task.description && <p className="text-[#f8f1e5]/50 text-xs mb-2">{task.description}</p>}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {task.assignee && (
                    <span className="text-[#f8f1e5]/40 text-xs">
                      {task.assignee.user.firstName}
                    </span>
                  )}
                  {task.deadline && (
                    <span className="text-[#f8f1e5]/40 text-xs">
                      · {new Date(task.deadline).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
                {/* Status cycle button */}
                <button
                  onClick={() => {
                    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(task.status) + 1) % STATUS_ORDER.length];
                    updateStatus(task, next);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 ${STATUS_LABELS[task.status].color}`}
                >
                  {STATUS_LABELS[task.status].label}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="w-full bg-[#1e3357] rounded-t-3xl p-6 flex flex-col gap-4">
            <h2 className="font-bold">มอบหมายงานใหม่</h2>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="ชื่องาน *"
              className="bg-white/10 rounded-xl px-4 py-3 text-sm outline-none placeholder:text-[#f8f1e5]/30"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="รายละเอียด (ไม่บังคับ)"
              rows={2}
              className="bg-white/10 rounded-xl px-4 py-3 text-sm outline-none placeholder:text-[#f8f1e5]/30 resize-none"
            />
            <div>
              <label className="text-xs text-[#f8f1e5]/50 mb-1 block">กำหนดเสร็จ</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                className="bg-white/10 rounded-xl px-4 py-3 text-sm outline-none w-full"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-sm">
                ยกเลิก
              </button>
              <button
                onClick={createTask}
                disabled={saving || !form.title.trim()}
                className="flex-1 py-3 rounded-xl bg-[#fb8500] text-white font-bold text-sm disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      <HrNav />
    </div>
  );
}
