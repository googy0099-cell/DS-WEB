"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string };

export default function MobileNav({ items, username, role }: { items: NavItem[]; username: string; role: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Hamburger button — fixed bottom-right */}
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
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-up drawer */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-navy rounded-t-3xl shadow-2xl transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle bar */}
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

        {/* Nav items grid */}
        <nav className="p-4 grid grid-cols-3 gap-2 max-h-[65vh] overflow-y-auto pb-8">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl transition-colors ${
                  active
                    ? "bg-orange/20 text-orange"
                    : "text-cream/70 hover:bg-cream/10 hover:text-cream active:bg-cream/20"
                }`}
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
