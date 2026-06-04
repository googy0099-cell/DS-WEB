"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const NAV = [
  { href: "/hr/checklist", label: "เช็คลิสต์", icon: "✅" },
  { href: "/hr/tasks", label: "งาน", icon: "📋" },
  { href: "/hr/kpi", label: "KPI", icon: "🎯" },
  { href: "/hr/dashboard", label: "ภาพรวม", icon: "📊", ownerOnly: true },
];

export default function HrNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;

  const items = NAV.filter((n) => !n.ownerOnly || role === "OWNER");

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#182a47]/95 backdrop-blur border-t border-white/10 z-50">
      <div className="flex">
        {items.map((n) => {
          const active = pathname === n.href || (n.href === CHECKIN_PATH && pathname === "/hr/checkin");
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
                active ? "text-[#fb8500]" : "text-[#f8f1e5]/50"
              }`}
            >
              <span className="text-xl">{n.icon}</span>
              <span className="text-[10px]">{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
