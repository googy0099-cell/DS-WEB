"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ memberCode: string; username: string } | null>(null);

  function setField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (form.password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          username: form.username,
          phone: form.phone || undefined,
          email: form.email,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด");
      } else {
        setSuccess({ memberCode: data.memberCode, username: data.username });
      }
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-lg text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-navy mb-2">สมัครสมาชิกสำเร็จ!</h1>
          <p className="text-gray-500 text-sm mb-6">บันทึกรหัสสมาชิกของคุณไว้ด้วยนะคะ</p>

          <div className="bg-navy rounded-2xl p-6 mb-6">
            <p className="text-cream/60 text-xs mb-1">รหัสสมาชิกของคุณ</p>
            <p className="text-5xl font-bold text-orange tracking-[0.2em]">{success.memberCode}</p>
            <p className="text-cream/60 text-xs mt-2">username: @{success.username}</p>
          </div>

          <p className="text-gray-400 text-xs mb-6">
            รหัสนี้ใช้ระบุตัวตนในร้าน สามารถใช้สะสมคะแนนและเข้าร่วมกิจกรรมได้
          </p>

          <button
            onClick={() => router.push("/login")}
            className="w-full bg-orange text-white font-bold py-3 rounded-xl"
          >
            เข้าสู่ระบบ →
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Image src="/DS-new-logo.png" alt="Dice Shop" width={140} height={50} className="mx-auto object-contain mb-4 h-12 w-auto" />
          <h1 className="text-xl font-bold text-navy">สมัครสมาชิก</h1>
          <p className="text-gray-500 text-sm">สะสมคะแนน เข้าร่วมกิจกรรม</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-navy block mb-1">ชื่อ *</label>
              <input
                type="text"
                required
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-navy block mb-1">นามสกุล *</label>
              <input
                type="text"
                required
                value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-navy block mb-1">Username * (ใช้ในเกม)</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setField("username", e.target.value.toLowerCase())}
              placeholder="เช่น gamer123"
              className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-navy block mb-1">เบอร์โทร</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="08x-xxx-xxxx"
              className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-navy block mb-1">อีเมล *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-navy block mb-1">รหัสผ่าน * (อย่างน้อย 8 ตัว)</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-navy block mb-1">ยืนยันรหัสผ่าน *</label>
            <input
              type="password"
              required
              value={form.confirmPassword}
              onChange={(e) => setField("confirmPassword", e.target.value)}
              className="w-full border border-sand rounded-xl px-3 py-2 text-sm focus:border-orange focus:outline-none"
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? "กำลังสมัคร..." : "สมัครสมาชิก →"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          มีบัญชีแล้ว?{" "}
          <Link href="/login" className="text-orange font-semibold">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </main>
  );
}
