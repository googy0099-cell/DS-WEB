"use client";

import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Pencil, X } from "lucide-react";

type AdminUser = {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const { data: users = [], mutate } = useSWR<AdminUser[]>("/api/users", fetcher);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "", username: "", role: "CASHIER" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Edit state
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", username: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  if (session && session.user.role !== "OWNER") {
    redirect("/admin");
  }

  async function createUser() {
    setSaving(true);
    setFormError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setFormError(data.error || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
      return;
    }
    await mutate();
    setShowModal(false);
    setFormError("");
    setForm({ email: "", password: "", firstName: "", lastName: "", username: "", role: "STAFF" });
  }

  async function changeRole(id: number, role: string) {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
    mutate();
  }

  function openEdit(u: AdminUser) {
    setEditForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, username: u.username });
    setEditError("");
    setEditUser(u);
  }

  async function saveEdit() {
    if (!editUser) return;
    setEditSaving(true);
    setEditError("");
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editUser.id, ...editForm }),
    });
    setEditSaving(false);
    if (!res.ok) { setEditError("บันทึกไม่สำเร็จ"); return; }
    await mutate();
    setEditUser(null);
  }

  async function deleteUser(id: number) {
    if (!confirm("ลบผู้ใช้งานนี้?")) return;
    await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-navy">ผู้ใช้งานระบบ (Admin)</h1>
        <button onClick={() => setShowModal(true)} className="bg-orange text-white font-semibold px-4 py-2 rounded-xl text-sm">
          + เพิ่ม Staff
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand/40 border-b border-sand">
            <tr>
              <th className="text-left p-3 text-navy font-semibold">ผู้ใช้</th>
              <th className="text-left p-3 text-navy font-semibold">Role</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-sand/50 last:border-0">
                <td className="p-3">
                  <p className="font-medium text-navy">{u.firstName} {u.lastName}</p>
                  <p className="text-gray-400 text-xs">@{u.username} · {u.email}</p>
                </td>
                <td className="p-3">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="border border-sand rounded-lg px-2 py-1 text-xs"
                  >
                    <option value="CASHIER">CASHIER</option>
                    <option value="STAFF">STAFF</option>
                    <option value="OWNER">OWNER</option>
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-3 justify-end">
                    <button onClick={() => openEdit(u)} className="text-orange hover:text-orange/80">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteUser(u.id)} className="text-xs text-red-400 hover:underline">ลบ</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit user modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-navy text-lg">แก้ไขข้อมูล</h2>
              <button onClick={() => setEditUser(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-gray-400 text-xs mb-4">@{editUser.username} · {editUser.role}</p>
            <div className="space-y-3">
              {([
                { label: "ชื่อ", field: "firstName" },
                { label: "นามสกุล", field: "lastName" },
                { label: "Username", field: "username" },
                { label: "อีเมล", field: "email", type: "email" },
              ] as { label: string; field: keyof typeof editForm; type?: string }[]).map(({ label, field, type = "text" }) => (
                <div key={field}>
                  <label className="text-xs font-medium text-navy block mb-1">{label}</label>
                  <input
                    type={type}
                    value={editForm[field]}
                    onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
              ))}
            </div>
            {editError && <p className="mt-3 text-sm text-red-500">{editError}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditUser(null)} className="flex-1 border border-sand text-navy font-semibold py-2.5 rounded-xl text-sm">ยกเลิก</button>
              <button onClick={saveEdit} disabled={editSaving} className="flex-1 bg-orange text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
                {editSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create user modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); setFormError(""); } }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-bold text-navy text-lg mb-4">เพิ่ม Staff ใหม่</h2>
            <div className="space-y-3">
              {[
                { label: "ชื่อ", field: "firstName" },
                { label: "นามสกุล", field: "lastName" },
                { label: "Username", field: "username" },
                { label: "อีเมล", field: "email", type: "email" },
                { label: "รหัสผ่าน", field: "password", type: "password" },
              ].map(({ label, field, type = "text" }) => (
                <div key={field}>
                  <label className="text-xs font-medium text-navy block mb-1">{label}</label>
                  <input
                    type={type}
                    value={(form as Record<string, string>)[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-navy block mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border border-sand rounded-xl px-3 py-2 text-sm"
                >
                  <option value="STAFF">STAFF</option>
                  <option value="OWNER">OWNER</option>
                </select>
              </div>
            </div>
            {formError && (
              <p className="mt-4 text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                ⚠️ {formError}
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setShowModal(false); setFormError(""); }} className="flex-1 border border-sand text-navy font-semibold py-2.5 rounded-xl text-sm">ยกเลิก</button>
              <button onClick={createUser} disabled={saving} className="flex-1 bg-orange text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
                {saving ? "กำลังสร้าง..." : "สร้างบัญชี"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
