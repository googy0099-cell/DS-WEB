"use client";

import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

export default function ScanPage() {
  const { data: session, status } = useSession();
  const isLoggedIn = !!session?.user;
  const loading = status === "loading";

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy to-orange/20 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-orange flex items-center justify-center mx-auto mb-4 shadow-xl shadow-orange/30">
          <span className="text-4xl">🎲</span>
        </div>
        <h1 className="text-white text-2xl font-bold tracking-wide">DICE SHOP</h1>
        <p className="text-white/60 text-sm mt-1">ร้านลูกเต๋า</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 space-y-4">
        {loading ? (
          <div className="text-center py-6 text-gray-400 text-sm">กำลังโหลด...</div>
        ) : (
          <>
            {isLoggedIn ? (
              <div className="bg-orange/10 rounded-2xl p-4 text-center mb-2">
                <p className="text-xs text-orange font-semibold mb-0.5">ยินดีต้อนรับกลับ</p>
                <p className="font-bold text-navy text-base">{session.user.firstName || session.user.username}</p>
                <p className="text-xs text-gray-400">#{session.user.memberCode}</p>
              </div>
            ) : (
              <div className="text-center mb-2">
                <p className="text-navy font-bold text-lg">ยินดีต้อนรับสู่</p>
                <p className="text-orange font-bold text-lg">DICE SHOP</p>
                <p className="text-gray-400 text-sm mt-1">เลือกสิ่งที่ต้องการทำ</p>
              </div>
            )}

            <div className="space-y-3">
              <Link
                href="/"
                className="flex items-center gap-3 w-full bg-navy text-white font-bold px-5 py-3.5 rounded-2xl hover:bg-navy/90 transition-colors"
              >
                <span className="text-2xl">🌐</span>
                <div className="text-left">
                  <p className="text-sm font-bold">เข้าสู่เว็บไซต์</p>
                  <p className="text-white/60 text-xs">ดูเมนู กิจกรรม และข้อมูลร้าน</p>
                </div>
              </Link>

              <Link
                href="/menu"
                className="flex items-center gap-3 w-full bg-orange text-white font-bold px-5 py-3.5 rounded-2xl hover:bg-orange/90 transition-colors"
              >
                <span className="text-2xl">🍜</span>
                <div className="text-left">
                  <p className="text-sm font-bold">สั่งอาหาร</p>
                  <p className="text-white/60 text-xs">เครื่องดื่ม อาหาร และของว่าง</p>
                </div>
              </Link>

              {!isLoggedIn && (
                <Link
                  href="/register"
                  className="flex items-center gap-3 w-full bg-sand text-navy font-bold px-5 py-3.5 rounded-2xl hover:bg-sand/80 transition-colors border border-sand"
                >
                  <span className="text-2xl">👤</span>
                  <div className="text-left">
                    <p className="text-sm font-bold">สมัครสมาชิก</p>
                    <p className="text-navy/50 text-xs">รับสิทธิพิเศษและสะสมแต้ม</p>
                  </div>
                </Link>
              )}
            </div>
          </>
        )}
      </div>

      <p className="text-white/30 text-xs mt-8">© DICE SHOP — ร้านลูกเต๋า</p>
    </div>
  );
}
