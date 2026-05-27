import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative bg-navy text-cream overflow-hidden">
      {/* Wave divider */}
      <div className="absolute top-0 left-0 right-0 -translate-y-[99%] pointer-events-none">
        <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
          <path d="M0 48 C360 0 1080 0 1440 48 L1440 48 L0 48 Z" fill="#182a47" />
        </svg>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-12 pb-8">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div className="flex flex-col items-center md:items-start gap-3">
            <Image
              src="/DS-new-logo.png"
              alt="Dice Shop"
              width={140}
              height={50}
              className="object-contain brightness-0 invert opacity-90 h-12 w-auto"
            />
            <p className="text-cream/50 text-sm leading-relaxed text-center md:text-left">
              พื้นที่บอร์ดเกม คาเฟ่ สำหรับทุกคน
            </p>
          </div>

          {/* Hours + address */}
          <div className="text-center md:text-left space-y-3">
            <p className="font-bold text-cream text-sm uppercase tracking-wider">เวลาเปิดทำการ</p>
            <p className="text-cream/60 text-sm">15:00 – 23:00 น. ทุกวัน จ - ศ</p>
            <p className="text-cream/60 text-sm">13:00 – 23:00 น. ทุกวัน ส - อา</p>
            <p className="text-cream/50 text-xs leading-relaxed">
              10/30-31 ถ.เจริญประดิษฐ์<br />
              ต.สะบารัง อ.เมือง ปัตตานี 94000
            </p>
          </div>

          {/* Links */}
          <div className="text-center md:text-left space-y-3">
            <p className="font-bold text-cream text-sm uppercase tracking-wider">ลิงก์</p>
            <div className="flex flex-col gap-2">
              <Link href="/games" className="text-cream/60 text-sm hover:text-orange transition-colors">คู่มือเกม</Link>
              <Link href="/menu" className="text-cream/60 text-sm hover:text-orange transition-colors">เมนูอาหาร</Link>
              <Link href="/activities" className="text-cream/60 text-sm hover:text-orange transition-colors">กิจกรรม</Link>
              <Link href="/play" className="text-cream/60 text-sm hover:text-orange transition-colors">มินิเกม</Link>
              <Link href="/#contact" className="text-cream/60 text-sm hover:text-orange transition-colors">ติดต่อเรา</Link>
            </div>
          </div>
        </div>

        <div className="border-t border-cream/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-cream/30 text-xs">© 2025 DICESHOP. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="https://www.facebook.com/profile.php?id=61557368743890" target="_blank" rel="noopener noreferrer" className="text-cream/40 hover:text-cream transition-colors text-sm">Facebook</a>
            <a href="https://www.instagram.com/looktaodiceshop/" target="_blank" rel="noopener noreferrer" className="text-cream/40 hover:text-cream transition-colors text-sm">Instagram</a>
            <a href="https://www.tiktok.com/@looktao.diceshop" target="_blank" rel="noopener noreferrer" className="text-cream/40 hover:text-cream transition-colors text-sm">TikTok</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
