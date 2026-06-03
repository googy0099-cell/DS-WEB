"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { label: string; items: NavItem[] };

export default function MobileNav({
  groups,
  username,
  role,
}: {
  groups: NavGroup[];
  username: string;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const pathname = usePathname();

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function isActive(href: string) {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  }

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-navy shadow-xl flex flex-col items-center justify-center gap-1.5 border border-cream/20"
        aria-label="เมนู"
      >
        <span className="block w-5 h-0.5 bg-cream rounded-full" />
        <span className="block w-5 h-0.5 bg-cream rounded-full" />
        <span className="block w-5 h-0.5 bg-cream rounded-full" />
      </button>

      {/* Backdrop */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)} />
      )}

      {/* Slide-up drawer */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-navy rounded-t-3xl shadow-2xl transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-cream/30 rounded-full" />
        </div>

        {/* User info */}
        <div className="px-5 py-3 border-b border-cream/10 flex items-center justify-between">
          <div>
            <p className="text-cream text-sm font-semibold">{username}</p>
            <p className="text-orange text-xs">{role}</p>
          </div>
          <button onClick={() => setOpen(false)} className="text-cream/50 text-2xl leading-none">×</button>
        </div>

        {/* Nav */}
        <nav className="px-3 pt-2 pb-8 flex flex-col gap-0.5 max-h-[70vh] overflow-y-auto">
          {role === "OWNER" && (
            <>
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-cream/70 hover:bg-cream/10 hover:text-cream transition-colors"
              >
                <span className="text-xl">🏠</span>
                <span className="text-sm font-medium">กลับหน้าหลัก</span>
              </Link>
              <div className="my-1 border-t border-cream/10" />
            </>
          )}

          {groups.map((group, gi) => {
            const groupOpen = !group.label || !collapsedGroups.has(group.label);

            return (
              <div key={group.label || gi}>
                {/* Group header */}
                {group.label && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between px-4 py-2 text-cream/40 hover:text-cream/60 transition-colors"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-widest">
                      {group.label}
                    </span>
                    <span className={`text-sm transition-transform duration-200 ${groupOpen ? "rotate-90" : ""}`}>›</span>
                  </button>
                )}

                {/* Items */}
                {groupOpen && (
                  <div className="space-y-0.5 mb-1">
                    {group.items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${
                            active
                              ? "bg-orange/20 text-orange"
                              : "text-cream/70 hover:bg-cream/10 hover:text-cream"
                          }`}
                        >
                          <span className="text-xl">{item.icon}</span>
                          <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {gi < groups.length - 1 && (
                  <div className="my-1 border-t border-cream/10" />
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </>
  );
}
