import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import RegisterSW from "@/components/admin/RegisterSW";
import MobileNav from "@/components/admin/MobileNav";
import SidebarNav from "@/components/admin/SidebarNav";

export const metadata: Metadata = {
  manifest: "/manifest-admin.json",
};

const DASHBOARD_NAV = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
];

const STAFF_NAV = [
  { href: "/admin/pos", label: "จัดการปาร์ตี้", icon: "⏱️" },
  { href: "/admin/cashier", label: "รอบการขาย", icon: "💲" },
  { href: "/admin/menu", label: "จัดการเมนู", icon: "🍜" },
  { href: "/admin/addon-groups", label: "Set Add-on", icon: "➕" },
  { href: "/admin/option-groups", label: "ตัวเลือก", icon: "🎛️" },
  { href: "/admin/activities", label: "กิจกรรม", icon: "🎉" },
  { href: "/admin/gallery", label: "Gallery", icon: "🖼️" },
  { href: "/admin/kitchen", label: "คิวครัว", icon: "🍳" },
  { href: "/admin/bar", label: "คิวบาร์", icon: "🥤" },
  { href: "/admin/games", label: "บอร์ดเกม", icon: "🎲" },
  { href: "/admin/mini-games", label: "มินิเกม", icon: "🎮" },
  { href: "/admin/werewolf", label: "Werewolf GM", icon: "🐺" },
  { href: "/admin/stock", label: "สต็อก", icon: "📦" },
  { href: "/admin/sop", label: "สูตรอาหาร", icon: "📋" },
];

const OWNER_ONLY_NAV = [
  { href: "/admin/members", label: "สมาชิก", icon: "👥" },
  { href: "/admin/users", label: "ผู้ใช้งานระบบ", icon: "🔑" },
  { href: "/admin/analytics", label: "วิเคราะห์ข้อมูล", icon: "📈" },
  { href: "/admin/audit", label: "Log การทำงาน", icon: "📋" },
  { href: "/admin/rewards", label: "จัดการรางวัล", icon: "🎁" },
  { href: "/admin/settings", label: "ตั้งค่าการชำระ", icon: "⚙️" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  const role = session.user.role;
  if (role !== "CASHIER" && role !== "STAFF" && role !== "OWNER") {
    redirect("/");
  }

  // CASHIER: dashboard + all staff nav
  // STAFF: all staff nav (no dashboard)
  // OWNER: dashboard + staff nav + owner-only nav
  const allNav =
    role === "OWNER"
      ? [...DASHBOARD_NAV, ...STAFF_NAV, ...OWNER_ONLY_NAV]
      : role === "CASHIER"
      ? [...DASHBOARD_NAV, ...STAFF_NAV]
      : STAFF_NAV;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-navy min-h-screen shrink-0">
        <div className="p-4 border-b border-cream/10">
          <Link href="/">
            <Image
              src="/แแแแ-Photoroom.png"
              alt="Dice Shop"
              width={180}
              height={64}
              className="object-contain brightness-0 invert h-30 w-auto"
            />
          </Link>
          <p className="text-cream/40 text-xs mt-1">Admin Panel</p>
        </div>

        <SidebarNav items={allNav} />

        <div className="p-4 border-t border-cream/10">
          <p className="text-cream/60 text-xs">{session.user.username}</p>
          <p className="text-orange text-xs font-semibold">{session.user.role}</p>
        </div>
      </aside>

      {/* Mobile hamburger nav */}
      <MobileNav items={allNav} username={session.user.username ?? ""} role={session.user.role ?? ""} />

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 w-full overflow-x-hidden">
        <RegisterSW />
        {children}
      </main>
    </div>
  );
}
