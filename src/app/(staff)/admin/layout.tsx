import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import RegisterSW from "@/components/admin/RegisterSW";
import WakeLock from "@/components/admin/WakeLock";
import MobileNav from "@/components/admin/MobileNav";
import SidebarNav from "@/components/admin/SidebarNav";
import GlobalOrderAlert from "@/components/admin/GlobalOrderAlert";
import AppointmentBanner from "@/components/admin/AppointmentBanner";
import ChecklistStatusBanner from "@/components/admin/ChecklistStatusBanner";

export const metadata: Metadata = {
  manifest: "/manifest-admin.json",
};

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { label: string; items: NavItem[] };

const GROUP_DASHBOARD: NavGroup = {
  label: "",
  items: [{ href: "/admin", label: "Dashboard", icon: "dashboard" }],
};

const GROUP_SALES: NavGroup = {
  label: "การขาย",
  items: [
    { href: "/admin/pos", label: "จัดการปาร์ตี้", icon: "pos" },
    { href: "/admin/cashier", label: "รอบการขาย", icon: "cashier" },
    { href: "/admin/kitchen", label: "คิวครัว", icon: "kitchen" },
    { href: "/admin/bar", label: "คิวบาร์", icon: "bar" },
  ],
};

const GROUP_MENU: NavGroup = {
  label: "เมนู & ครัว",
  items: [
    { href: "/admin/menu", label: "จัดการเมนู", icon: "menu" },
    { href: "/admin/addon-groups", label: "Set Add-on", icon: "addon-groups" },
    { href: "/admin/option-groups", label: "ตัวเลือก", icon: "option-groups" },
    { href: "/admin/stock", label: "สต็อก", icon: "stock" },
    { href: "/admin/sop", label: "สูตรอาหาร", icon: "sop" },
  ],
};

const GROUP_GAMES: NavGroup = {
  label: "เกม",
  items: [
    { href: "/admin/games", label: "บอร์ดเกม", icon: "games" },
    { href: "/admin/mini-games", label: "มินิเกม", icon: "mini-games" },
    { href: "/admin/werewolf", label: "Werewolf GM", icon: "werewolf" },
  ],
};

const GROUP_CUSTOMERS_STAFF: NavGroup = {
  label: "ลูกค้า",
  items: [
    { href: "/admin/activities", label: "กิจกรรม", icon: "activities" },
    { href: "/admin/gallery", label: "Gallery", icon: "gallery" },
  ],
};

const GROUP_CUSTOMERS_OWNER: NavGroup = {
  label: "ลูกค้า",
  items: [
    { href: "/admin/members", label: "สมาชิก", icon: "members" },
    { href: "/admin/activities", label: "กิจกรรม", icon: "activities" },
    { href: "/admin/gallery", label: "Gallery", icon: "gallery" },
    { href: "/admin/rewards", label: "จัดการรางวัล", icon: "rewards" },
  ],
};

const GROUP_SYSTEM: NavGroup = {
  label: "จัดการ",
  items: [
    { href: "/admin/users", label: "ผู้ใช้งานระบบ", icon: "users" },
    { href: "/admin/analytics", label: "วิเคราะห์ข้อมูล", icon: "analytics" },
    { href: "/admin/audit", label: "Log การทำงาน", icon: "audit" },
    { href: "/admin/tables", label: "โต๊ะ & QR Code", icon: "tables" },
    { href: "/admin/settings", label: "การตั้งค่า", icon: "settings" },
  ],
};

const GROUP_HR: NavGroup = {
  label: "HR",
  items: [
    { href: "/admin/hr/schedule", label: "ตารางพนักงาน", icon: "hr-schedule" },
    { href: "/admin/hr/payroll", label: "เงินเดือน", icon: "hr-payroll" },
    { href: "/admin/hr/payment-calendar", label: "ปฏิทินจ่ายเงิน", icon: "hr-calendar" },
    { href: "/admin/hr/checklist", label: "เช็คลิสต์", icon: "hr-checklist" },
  ],
};

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

  const groups: NavGroup[] =
    role === "OWNER"
      ? [GROUP_DASHBOARD, GROUP_SALES, GROUP_MENU, GROUP_GAMES, GROUP_CUSTOMERS_OWNER, GROUP_SYSTEM, GROUP_HR]
      : role === "CASHIER"
      ? [GROUP_DASHBOARD, GROUP_SALES, GROUP_MENU, GROUP_GAMES, GROUP_CUSTOMERS_STAFF]
      : [GROUP_SALES, GROUP_MENU, GROUP_GAMES, GROUP_CUSTOMERS_STAFF];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarNav
        groups={groups}
        username={session.user.username ?? ""}
        role={session.user.role ?? ""}
      />
      <MobileNav groups={groups} username={session.user.username ?? ""} role={session.user.role ?? ""} />

      <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 w-full overflow-x-hidden min-w-0">
        <RegisterSW />
        <WakeLock />
        {role === "OWNER" && <AppointmentBanner />}
        <ChecklistStatusBanner />
        {children}
      </main>

      <GlobalOrderAlert />
    </div>
  );
}
