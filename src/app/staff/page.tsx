"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

const MENU = [
  { href: "/staff/checklist", icon: "✅", label: "เช็คลิสต์", desc: "เปิด-ปิดร้าน" },
  { href: "/staff/tasks", icon: "📋", label: "งาน", desc: "ดูและอัพเดตงานที่ได้รับมอบหมาย" },
  { href: "/staff/kpi", icon: "🎯", label: "KPI", desc: "เป้าหมายและผลงานรายเดือน" },
  { href: "/staff/kitchen", icon: "🍳", label: "คิวครัว", desc: "ออเดอร์อาหารที่ต้องเตรียม" },
  { href: "/staff/bar", icon: "🥤", label: "คิวบาร์", desc: "ออเดอร์เครื่องดื่มที่ต้องเตรียม" },
];

const OWNER_MENU = [
  { href: "/staff/dashboard", icon: "📊", label: "ภาพรวมทีม", desc: "สรุปการทำงานของพนักงาน" },
];

export default function StaffHomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string })?.role;
  const name = (session?.user as { firstName?: string })?.firstName ?? session?.user?.name ?? "พนักงาน";

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/api/auth/signin");
  }, [status, router]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-[#f8f1e5]/40 text-sm">กำลังโหลด...</div>;
  }

  const allMenu = role === "OWNER" ? [...MENU, ...OWNER_MENU] : MENU;

  return (
    <div className="min-h-screen px-4 pt-10 pb-10 flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[#f8f1e5]/50 text-sm">ยินดีต้อนรับ</p>
        <h1 className="text-2xl font-bold text-[#f8f1e5]">{name} 👋</h1>
        {role && (
          <span className="inline-block mt-1 text-xs font-semibold bg-[#fb8500]/20 text-[#fb8500] px-2.5 py-0.5 rounded-full">
            {role === "OWNER" ? "เจ้าของร้าน" : role === "CASHIER" ? "แคชเชียร์" : "พนักงาน"}
          </span>
        )}
      </div>

      {/* Menu cards */}
      <div className="flex flex-col gap-3 flex-1">
        {allMenu.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 active:scale-[0.98] transition-transform"
          >
            <span className="text-3xl shrink-0">{item.icon}</span>
            <div>
              <p className="font-bold text-[#f8f1e5] text-base">{item.label}</p>
              <p className="text-[#f8f1e5]/40 text-xs mt-0.5">{item.desc}</p>
            </div>
            <span className="ml-auto text-[#f8f1e5]/20 text-lg">›</span>
          </Link>
        ))}
      </div>

      {/* Sign out */}
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="mt-8 text-[#f8f1e5]/30 text-xs text-center hover:text-[#f8f1e5]/60 transition-colors"
      >
        ออกจากระบบ
      </button>
    </div>
  );
}
