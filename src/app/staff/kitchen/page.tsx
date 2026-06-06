"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import KitchenQueue from "@/components/admin/KitchenQueue";

export default function StaffKitchenPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/api/auth/signin");
  }, [status, router]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-[#f8f1e5]/40 text-sm">กำลังโหลด...</div>;
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-[#182a47] border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <Link href="/staff" className="text-[#f8f1e5]/60 hover:text-[#f8f1e5] text-sm font-semibold transition-colors">
          ← กลับ
        </Link>
        <h1 className="text-[#f8f1e5] font-bold text-base">🍳 คิวครัว</h1>
      </div>
      <div className="bg-[#f8f1e5] min-h-[calc(100vh-53px)]">
        <KitchenQueue type="food" />
      </div>
    </div>
  );
}
