import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import RegisterSW from "@/components/admin/RegisterSW";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/menu", label: "จัดการเมนู", icon: "🍜" },
  { href: "/admin/addon-groups", label: "Set Add-on", icon: "➕" },
  { href: "/admin/option-groups", label: "ตัวเลือก", icon: "🎛️" },
  { href: "/admin/activities", label: "กิจกรรม", icon: "🎉" },
  { href: "/admin/gallery", label: "Gallery", icon: "🖼️" },
  { href: "/admin/games", label: "บอร์ดเกม", icon: "🎲" },
  { href: "/admin/payment", label: "ยืนยันชำระ", icon: "💳" },
];

const OWNER_NAV = [
  { href: "/admin/members", label: "สมาชิก", icon: "👥" },
  { href: "/admin/users", label: "ผู้ใช้งานระบบ", icon: "🔑" },
  { href: "/admin/analytics", label: "วิเคราะห์ข้อมูล", icon: "📈" },
  { href: "/admin/audit", label: "Log การทำงาน", icon: "📋" },
  { href: "/admin/settings", label: "ตั้งค่าการชำระ", icon: "⚙️" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "STAFF" && session.user.role !== "OWNER") {
    redirect("/");
  }

  const isOwner = session.user.role === "OWNER";
  const allNav = isOwner ? [...NAV, ...OWNER_NAV] : NAV;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-navy min-h-screen shrink-0">
        <div className="p-4 border-b border-cream/10">
          <Link href="/">
            <Image
              src="/DS-new-logo.png"
              alt="Dice Shop"
              width={100}
              height={36}
              className="object-contain brightness-0 invert h-8 w-auto"
            />
          </Link>
          <p className="text-cream/40 text-xs mt-1">Admin Panel</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {allNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-cream/70 hover:text-cream hover:bg-cream/10 text-sm font-medium transition-colors"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-cream/10">
          <p className="text-cream/60 text-xs">{session.user.username}</p>
          <p className="text-orange text-xs font-semibold">{session.user.role}</p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-navy z-50 border-t border-cream/10">
        <div className="flex overflow-x-auto scrollbar-none">
          {allNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-2.5 text-cream/60 active:text-cream min-w-[64px] shrink-0"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[9px] whitespace-nowrap">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 w-full overflow-x-hidden">
        <RegisterSW />
        {children}
      </main>
    </div>
  );
}
