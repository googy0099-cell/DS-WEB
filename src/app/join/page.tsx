"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length === 6) router.push(`/join/${trimmed}`);
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <Image src="/DS-new-logo.png" alt="Dice Shop" width={80} height={44} className="object-contain brightness-0 invert mx-auto mb-4" />
        <h1 className="text-white text-2xl font-bold">🐺 เข้าร่วมเกม Werewolf</h1>
        <p className="text-gray-400 text-sm mt-2">ใส่รหัสห้องที่ได้รับจาก GM</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="XXXXXX"
          maxLength={6}
          className="w-full text-center text-4xl font-bold tracking-[0.3em] bg-gray-800 border-2 border-gray-600 focus:border-yellow-400 text-white rounded-2xl py-5 mb-4 outline-none transition-colors"
          autoComplete="off"
          autoCapitalize="characters"
        />
        <button
          type="submit"
          disabled={code.trim().length !== 6}
          className="w-full bg-yellow-500 text-black font-bold py-4 rounded-xl text-lg shadow-lg disabled:opacity-40 active:bg-yellow-400"
        >
          เข้าห้อง →
        </button>
      </form>
    </div>
  );
}
