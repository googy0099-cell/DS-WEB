"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const NAV_ITEMS = [
  { label: "หน้าแรก", href: "/", section: "hero" },
  { label: "สั่งอาหาร", href: "/menu" },
  { label: "มินิเกม", href: "/play" },
  { label: "บอร์ดเกม", href: "/games" },
  { label: "กิจกรรม", href: "/activities" },
  { label: "เกี่ยวกับเรา", href: "/#about", section: "about" },
  { label: "ติดต่อเรา", href: "/#contact", section: "contact" },
  { label: "🐺 Werewolf", href: "/#werewolf", section: "werewolf" },
];

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropOpen, setUserDropOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const userDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userDropRef.current && !userDropRef.current.contains(e.target as Node)) {
        setUserDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (pathname !== "/") return;
    const sections = ["hero", "about", "contact", "werewolf"];
    const observers: IntersectionObserver[] = [];
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { threshold: 0.4 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [pathname]);

  function isActive(item: typeof NAV_ITEMS[0]) {
    if (item.section) {
      return pathname === "/" && activeSection === item.section;
    }
    return pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy shadow-lg">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/แแแแ-Photoroom.png"
            alt="Dice Shop"
            width={144}
            height={48}
            className="object-contain brightness-0 invert h-25 w-auto"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                isActive(item)
                  ? "text-cream border-orange"
                  : "text-cream/80 hover:text-cream border-transparent"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Mobile center: member code + username */}
        {session?.user && (
          <Link href="/profile" className="flex-1 flex lg:hidden justify-center px-2 min-w-0">
            <div className="text-center leading-tight">
              <p className="font-bold text-sm tracking-widest text-orange">{session.user.memberCode}</p>
              <p className="text-xs truncate text-cream/60">@{session.user.username}</p>
            </div>
          </Link>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {session?.user ? (
            <div ref={userDropRef} className="relative">
              <button
                onClick={() => setUserDropOpen((v) => !v)}
                className="hidden lg:flex items-center gap-2 bg-cream/10 hover:bg-cream/20 text-cream text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
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
                    className="hidden lg:block px-4 py-3 text-sm text-navy hover:bg-sand"
                  >
                    👤 โปรไฟล์ ({session.user.memberCode})
                  </Link>
                  {(session.user.role === "OWNER" || session.user.role === "STAFF" || session.user.role === "CASHIER") && (
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
              className="text-cream/80 hover:text-cream text-sm font-medium px-3 py-2 transition-colors hidden lg:block"
            >
              เข้าสู่ระบบ
            </Link>
          )}

          {/* Hamburger */}
          <button
            className="lg:hidden text-cream p-2"
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
        <div className="lg:hidden bg-navy border-t border-cream/10 px-4 pb-6">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`block py-4 text-lg font-semibold border-b border-cream/10 last:border-0 transition-colors ${
                isActive(item) ? "text-orange" : "text-cream/90 hover:text-cream"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {session?.user ? (
            <div className="mt-5 pt-4 border-t border-cream/10 space-y-3">
              <Link href="/profile" onClick={() => setMobileOpen(false)} className="block py-3 text-cream/80 text-base font-medium border-b border-cream/10">
                👤 โปรไฟล์ ({session.user.memberCode})
              </Link>
              {(session.user.role === "OWNER" || session.user.role === "STAFF" || session.user.role === "CASHIER") && (
                <Link href="/admin" onClick={() => setMobileOpen(false)} className="block py-3 text-cream/80 text-base font-medium border-b border-cream/10">
                  ⚙️ จัดการร้าน
                </Link>
              )}
              <button onClick={() => signOut({ callbackUrl: "/" })} className="text-red-400 text-base font-medium py-3">
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <Link href="/login" onClick={() => setMobileOpen(false)} className="block mt-5 py-4 text-orange font-bold text-lg text-center bg-orange/10 rounded-xl">
              เข้าสู่ระบบ / สมัครสมาชิก
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
