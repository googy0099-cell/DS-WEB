import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-navy text-cream py-10 px-4">
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-4">
        <Image
          src="/DS-new-logo.png"
          alt="Dice Shop"
          width={140}
          height={50}
          className="object-contain brightness-0 invert opacity-90 h-12 w-auto"
        />

        <div className="text-cream/70 text-sm space-y-1">
          <p className="font-semibold text-cream">เวลาเปิดทำการ</p>
          <p>15:00 – 23:00 น. ทุกวัน</p>
        </div>

        <div className="flex gap-6 text-cream/60 text-sm">
          <Link href="/games" className="hover:text-cream transition-colors">คู่มือเกม</Link>
          <Link href="/menu" className="hover:text-cream transition-colors">เมนู</Link>
          <Link href="/activities" className="hover:text-cream transition-colors">กิจกรรม</Link>
          <Link href="/#contact" className="hover:text-cream transition-colors">ติดต่อเรา</Link>
        </div>

        <div className="border-t border-cream/10 pt-4 w-full text-center">
          <p className="text-cream/40 text-xs">© 2024 DICESHOP. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
