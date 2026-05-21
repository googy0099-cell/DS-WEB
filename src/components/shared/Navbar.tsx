"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

const NAV_ITEMS = [
  { label: "หน้าแรก", href: "/#hero" },
  {
    label: "ดูเมนู",
    children: [
      { label: "เครื่องดื่ม", href: "/menu/drink" },
      { label: "อาหารจานเดียว", href: "/menu/food" },
      { label: "ของทานเล่น", href: "/menu/snack" },
    ],
  },
  { label: "เกม", href: "/games" },
  { label: "กิจกรรม", href: "/activities" },
  { label: "เกี่ยวกับเรา", href: "/#about" },
  { label: "ติดต่อเรา", href: "/#contact" },
];

export default function Navbar() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuDropOpen, setMenuDropOpen] = useState(false);
  const [userDropOpen, setUserDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const userDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setMenuDropOpen(false);
      }
      if (userDropRef.current && !userDropRef.current.contains(e.target as Node)) {
        setUserDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy shadow-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/DS-new-logo.png"
            alt="Dice Shop"
            width={120}
            height={40}
            className="object-contain brightness-0 invert h-9 w-auto"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) =>
            item.children ? (
              <div key={item.label} ref={dropRef} className="relative">
                <button
                  onClick={() => setMenuDropOpen((v) => !v)}
                  className="px-3 py-2 text-cream/80 hover:text-cream text-sm font-medium transition-colors flex items-center gap-1"
                >
                  {item.label}
                  <span className="text-xs">▾</span>
                </button>
                {menuDropOpen && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-xl shadow-xl overflow-hidden">
                    {item.children.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => setMenuDropOpen(false)}
                        className="block px-4 py-2.5 text-sm text-navy hover:bg-sand transition-colors"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href!}
                className="px-3 py-2 text-cream/80 hover:text-cream text-sm font-medium transition-colors"
              >
                {item.label}
              </Link>
            )
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {session?.user ? (
            <div ref={userDropRef} className="relative">
              <button
                onClick={() => setUserDropOpen((v) => !v)}
                className="flex items-center gap-2 bg-cream/10 hover:bg-cream/20 text-cream text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-orange flex items-center justify-center text-white text-xs font-bold">
                  {session.user.firstName?.[0]?.toUpperCase() ?? "U"}
                </div>
                <span className="hidden sm:block">{session.user.username}</span>
                <span className="text-xs">▾</span>
              </button>
              {userDropOpen && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-xl overflow-hidden">
                  <Link
                    href="/profile"
                    onClick={() => setUserDropOpen(false)}
                    className="block px-4 py-3 text-sm text-navy hover:bg-sand"
                  >
                    👤 โปรไฟล์ ({session.user.memberCode})
                  </Link>
                  {(session.user.role === "OWNER" || session.user.role === "STAFF") && (
                    <Link
                      href="/admin"
                      onClick={() => setUserDropOpen(false)}
                      className="block px-4 py-3 text-sm text-navy hover:bg-sand border-t border-sand"
                    >
                      ⚙️ จัดการร้าน
                    </Link>
                  )}
                  <button
                    onClick={() => { signOut({ callbackUrl: "/" }); setUserDropOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 border-t border-sand"
                  >
                    ออกจากระบบ
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="text-cream/80 hover:text-cream text-sm font-medium px-3 py-2 transition-colors hidden md:block"
            >
              เข้าสู่ระบบ
            </Link>
          )}

          {/* Hamburger */}
          <button
            className="md:hidden text-cream p-2"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="toggle menu"
          >
            <span className="block w-5 h-0.5 bg-cream mb-1" />
            <span className="block w-5 h-0.5 bg-cream mb-1" />
            <span className="block w-5 h-0.5 bg-cream" />
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-navy border-t border-cream/10 px-4 pb-4">
          {NAV_ITEMS.map((item) =>
            item.children ? (
              <div key={item.label}>
                <p className="text-cream/50 text-xs font-semibold uppercase tracking-wider mt-4 mb-1">
                  {item.label}
                </p>
                {item.children.map((sub) => (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    onClick={() => setMobileOpen(false)}
                    className="block py-2 pl-3 text-cream/80 hover:text-cream text-sm"
                  >
                    {sub.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href!}
                onClick={() => setMobileOpen(false)}
                className="block py-2 text-cream/80 hover:text-cream text-sm font-medium border-b border-cream/10 last:border-0"
              >
                {item.label}
              </Link>
            )
          )}
          {session?.user ? (
            <div className="mt-4 pt-4 border-t border-cream/10">
              <Link href="/profile" onClick={() => setMobileOpen(false)} className="block py-2 text-cream/80 text-sm">
                👤 โปรไฟล์ ({session.user.memberCode})
              </Link>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="text-red-400 text-sm py-2">
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <Link href="/login" onClick={() => setMobileOpen(false)} className="block mt-4 text-orange font-semibold text-sm">
              เข้าสู่ระบบ / สมัครสมาชิก
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
