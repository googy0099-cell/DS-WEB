"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string };

const STORAGE_KEY = "admin-sidebar-collapsed";

export default function SidebarNav({
  items,
  username,
  role,
}: {
  items: NavItem[];
  username: string;
  role: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
    setMounted(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem(STORAGE_KEY, !c ? "1" : "0");
      return !c;
    });
  }

  // Avoid flash of wrong width before localStorage read
  if (!mounted) return null;

  return (
    <aside
      className={`hidden md:flex flex-col bg-navy min-h-screen shrink-0 transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Header */}
      <div className={`p-3 border-b border-cream/10 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          role === "OWNER" ? (
            <Link href="/" className="flex-1 min-w-0">
              <Image
                src="/แแแแ-Photoroom.png"
                alt="Dice Shop"
                width={140}
                height={48}
                className="object-contain brightness-0 invert h-10 w-auto"
              />
              <p className="text-cream/40 text-xs mt-0.5">Admin Panel</p>
            </Link>
          ) : (
            <div className="flex-1 min-w-0">
              <Image
                src="/แแแแ-Photoroom.png"
                alt="Dice Shop"
                width={140}
                height={48}
                className="object-contain brightness-0 invert h-10 w-auto"
              />
              <p className="text-cream/40 text-xs mt-0.5">Admin Panel</p>
            </div>
          )
        )}
        <button
          onClick={toggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-cream/50 hover:text-cream hover:bg-cream/10 transition-colors shrink-0"
          aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-colors ${
                collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"
              } ${
                active
                  ? "bg-orange/20 text-orange"
                  : "text-cream/70 hover:text-cream hover:bg-cream/10"
              }`}
            >
              <span className="text-lg leading-none shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`p-3 border-t border-cream/10 ${collapsed ? "text-center" : ""}`}>
        {collapsed ? (
          <span className="text-cream/40 text-lg">👤</span>
        ) : (
          <>
            <p className="text-cream/60 text-xs truncate">{username}</p>
            <p className="text-orange text-xs font-semibold">{role}</p>
          </>
        )}
      </div>
    </aside>
  );
}
