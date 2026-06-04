"use client";

import { useEffect, useRef, useState } from "react";
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
  hrStaff: { id: number; hasPin: boolean; hasFace: boolean } | null;
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

  // HR PIN modal
  const [pinUser, setPinUser] = useState<AdminUser | null>(null);
  const [pin, setPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState("");

  // Face registration modal
  const [faceUser, setFaceUser] = useState<AdminUser | null>(null);
  const [faceStep, setFaceStep] = useState<"idle" | "camera" | "saving" | "done">("idle");
  const [faceMsg, setFaceMsg] = useState("");
  const [faceCountdown, setFaceCountdown] = useState(0);
  const faceVideoRef = useRef<HTMLVideoElement>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);

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

  async function savePin() {
    if (!pinUser || pin.length !== 4) return;
    setPinSaving(true);
    setPinError("");
    const res = await fetch("/api/hr/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: pinUser.id, pin }),
    });
    setPinSaving(false);
    if (!res.ok) { setPinError("บันทึกไม่สำเร็จ"); return; }
    await mutate();
    setPinUser(null);
    setPin("");
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

  function stopFaceCamera() {
    faceStreamRef.current?.getTracks().forEach((t) => t.stop());
    faceStreamRef.current = null;
  }

  function openFaceRegister(u: AdminUser) {
    if (!u.hrStaff) {
      alert("ต้องตั้ง HR PIN ก่อนถึงจะลงทะเบียนใบหน้าได้");
      return;
    }
    setFaceUser(u);
    setFaceStep("camera");
    setFaceMsg("");
    setFaceCountdown(3);
  }

  function closeFaceModal() {
    stopFaceCamera();
    setFaceUser(null);
    setFaceStep("idle");
    setFaceMsg("");
    setFaceCountdown(0);
  }

  useEffect(() => {
    if (faceStep !== "camera" || !faceUser) return;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } } })
      .then((stream) => {
        faceStreamRef.current = stream;
        if (faceVideoRef.current) faceVideoRef.current.srcObject = stream;
        // countdown 3..2..1 then capture
        let n = 3;
        setFaceCountdown(n);
        const tick = () => {
          n -= 1;
          setFaceCountdown(n);
          if (n === 0) { captureAndSaveFace(); return; }
          setTimeout(tick, 1000);
        };
        setTimeout(tick, 1000);
      })
      .catch(() => {
        setFaceMsg("เปิดกล้องไม่ได้");
        setFaceStep("idle");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceStep, faceUser]);

  async function captureAndSaveFace() {
    if (!faceVideoRef.current || !faceUser?.hrStaff) return;
    const v = faceVideoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    const photo = canvas.toDataURL("image/jpeg", 0.85);
    stopFaceCamera();
    setFaceStep("saving");
    setFaceMsg("กำลังบันทึก...");
    const res = await fetch("/api/hr/face/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: faceUser.hrStaff.id, photo }),
    });
    if (!res.ok) {
      const d = await res.json();
      setFaceMsg(d.error ?? "บันทึกไม่สำเร็จ");
      setFaceStep("idle");
      return;
    }
    setFaceMsg(`ลงทะเบียนใบหน้า ${faceUser.firstName} สำเร็จ`);
    setFaceStep("done");
    await mutate();
    setTimeout(() => closeFaceModal(), 2500);
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
              <th className="text-left p-3 text-navy font-semibold">HR</th>
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
                    <option value="STAFF">STAFF</option>
                    <option value="CASHIER">CASHIER</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="OWNER">OWNER</option>
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => { setPinUser(u); setPin(""); setPinError(""); }}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                        u.hrStaff?.hasPin
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : u.hrStaff
                          ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                          : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {u.hrStaff?.hasPin ? "PIN ✓" : u.hrStaff ? "ไม่มี PIN" : "ตั้ง HR"}
                    </button>
                    {u.hrStaff && (
                      <button
                        onClick={() => openFaceRegister(u)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                          u.hrStaff.hasFace
                            ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                            : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {u.hrStaff.hasFace ? "ใบหน้า ✓" : "ลงทะเบียนหน้า"}
                      </button>
                    )}
                  </div>
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

      {/* HR PIN modal */}
      {pinUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPinUser(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-navy text-lg">ตั้ง PIN ระบบ HR</h2>
              <button onClick={() => setPinUser(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-gray-400 text-xs mb-4">{pinUser.firstName} {pinUser.lastName}</p>
            <div>
              <label className="text-xs font-medium text-navy block mb-1">PIN 4 หลัก</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="กรอก PIN 4 หลัก"
                className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none text-center tracking-widest text-lg"
              />
            </div>
            {pinError && <p className="mt-2 text-sm text-red-500">{pinError}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setPinUser(null)} className="flex-1 border border-sand text-navy font-semibold py-2.5 rounded-xl text-sm">ยกเลิก</button>
              <button onClick={savePin} disabled={pinSaving || pin.length !== 4} className="flex-1 bg-orange text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50">
                {pinSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Face registration modal */}
      {faceUser && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center gap-5 px-6">
          {(faceStep === "camera" || faceStep === "saving") && (
            <>
              <p className="text-white text-sm">{faceUser.firstName} {faceUser.lastName}</p>
              <div
                className="relative rounded-full overflow-hidden border-4 border-orange bg-black"
                style={{ width: "min(72vw, 280px)", height: "min(72vw, 280px)" }}
              >
                <video
                  ref={faceVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {faceStep === "camera" && faceCountdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-7xl font-bold text-orange drop-shadow-lg">{faceCountdown}</div>
                  </div>
                )}
                {faceStep === "saving" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="w-12 h-12 border-4 border-orange border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <p className="text-white font-bold">มองตรงๆ ที่กล้อง</p>
            </>
          )}
          {faceStep === "idle" && faceMsg && (
            <p className="text-red-400 text-sm text-center bg-red-400/10 rounded-xl py-3 px-4">{faceMsg}</p>
          )}
          {faceStep === "done" && (
            <>
              <div className="text-6xl">✅</div>
              <p className="text-white font-bold text-lg text-center">{faceMsg}</p>
            </>
          )}
          {faceStep !== "saving" && (
            <button onClick={closeFaceModal} className="text-white/60 text-sm underline">ยกเลิก / ปิด</button>
          )}
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
                  <option value="CASHIER">CASHIER</option>
                  <option value="MANAGER">MANAGER</option>
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
