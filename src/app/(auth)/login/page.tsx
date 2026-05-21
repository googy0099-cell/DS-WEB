"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    } else {
      router.push(callbackUrl);
    }
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Image src="/DS-new-logo.png" alt="Dice Shop" width={140} height={50} className="mx-auto object-contain mb-4 h-12 w-auto" />
          <h1 className="text-xl font-bold text-navy">เข้าสู่ระบบ</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-medium text-navy block mb-1">อีเมล</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-navy block mb-1">รหัสผ่าน</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className="w-full border border-sand rounded-xl px-3 py-2.5 text-sm focus:border-orange focus:outline-none"
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ →"}
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-sand" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-400 bg-white px-2 w-fit mx-auto">หรือ</div>
          </div>

          <button
            type="button"
            disabled
            title="กรุณาตั้งค่า Google OAuth ก่อน (ดู AUTH_GUIDE.md)"
            className="w-full border-2 border-sand text-gray-400 font-semibold py-3 rounded-xl text-sm cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span className="text-lg">🔵</span>
            เข้าสู่ระบบด้วย Google (ยังไม่เปิดใช้)
          </button>
          <p className="text-center text-xs text-gray-400">ต้องตั้งค่า Google OAuth ก่อน — ดู AUTH_GUIDE.md</p>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          ยังไม่มีบัญชี?{" "}
          <Link href="/register" className="text-orange font-semibold">
            สมัครสมาชิก
          </Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-2">
          <Link href="/" className="underline">← กลับหน้าแรก</Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
