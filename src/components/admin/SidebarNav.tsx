"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { label: string; items: NavItem[] };

const SIDEBAR_KEY = "admin-sidebar-collapsed";
const GROUPS_KEY = "admin-sidebar-groups";

export default function SidebarNav({
  groups,
  username,
  role,
}: {
  groups: NavGroup[];
  username: string;
  role: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "1") setCollapsed(true);

    const storedGroups = localStorage.getItem(GROUPS_KEY);
    if (storedGroups) {
      try { setCollapsedGroups(new Set(JSON.parse(storedGroups))); } catch {}
    }
    setMounted(true);
  }, []);

  // Auto-expand the group that contains the active page
  useEffect(() => {
    if (!mounted) return;
    groups.forEach((g) => {
      if (!g.label) return;
      const hasActive = g.items.some((item) =>
        item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
      );
      if (hasActive) {
        setCollapsedGroups((prev) => {
          if (!prev.has(g.label)) return prev;
          const next = new Set(prev);
          next.delete(g.label);
          return next;
        });
      }
    });
  }, [pathname, groups, mounted]);

  function toggleSidebar() {
    setCollapsed((c) => {
      localStorage.setItem(SIDEBAR_KEY, !c ? "1" : "0");
      return !c;
    });
  }

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      localStorage.setItem(GROUPS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function isActive(href: string) {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  }

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
              <Image src="/แแแแ-Photoroom.png" alt="Dice Shop" width={140} height={48}
                className="object-contain brightness-0 invert h-10 w-auto" />
              <p className="text-cream/40 text-xs mt-0.5">Admin Panel</p>
            </Link>
          ) : (
            <div className="flex-1 min-w-0">
              <Image src="/แแแแ-Photoroom.png" alt="Dice Shop" width={140} height={48}
                className="object-contain brightness-0 invert h-10 w-auto" />
              <p className="text-cream/40 text-xs mt-0.5">Admin Panel</p>
            </div>
          )
        )}
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-cream/50 hover:text-cream hover:bg-cream/10 transition-colors shrink-0"
          aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 overflow-y-auto">
        {groups.map((group, gi) => {
          const groupOpen = !group.label || !collapsedGroups.has(group.label);

          return (
            <div key={group.label || gi} className="mb-1">
              {/* Group header (skip for unlabelled groups e.g. Dashboard) */}
              {group.label && !collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-cream/40 hover:text-cream/70 transition-colors"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest">
                    {group.label}
                  </span>
                  <span className={`text-xs transition-transform duration-200 ${groupOpen ? "rotate-90" : ""}`}>›</span>
                </button>
              )}

              {/* Items */}
              {(collapsed || groupOpen) && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-colors ${
                          collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2"
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
                </div>
              )}

              {/* Divider between groups */}
              {!collapsed && gi < groups.length - 1 && (
                <div className="my-1 border-t border-cream/5" />
              )}
            </div>
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
