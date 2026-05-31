"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

function useCountUp(target: number, duration = 1200, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const frame = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.floor(p * target));
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [active, target, duration]);
  return val;
}

export default function AboutSection() {
  const [aboutImg, setAboutImg] = useState<string | null>(null);
  const [inView, setInView] = useState(false);
  const [gameCount, setGameCount] = useState(170);
  const ref = useRef<HTMLElement>(null);

  const games = useCountUp(gameCount, 1400, inView);

  useEffect(() => {
    fetch("/api/gallery?section=about")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setAboutImg(data[0].imageUrl);
      })
      .catch(() => {});
    fetch("/api/games")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setGameCount(data.length); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="about" ref={ref} className="py-16 px-4 bg-cream">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
        {/* Text */}
        <div className="text-center md:text-left">
          <p className="text-orange font-semibold text-sm uppercase tracking-wider mb-2">เกี่ยวกับเรา</p>
          <h2 className="text-3xl md:text-2xl font-bold text-navy mb-4 leading-snug">
            พื้นที่สำหรับทุกคน
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            เราไม่ได้แค่วางเกมไว้บนโต๊ะ แต่เราสร้างพื้นที่ให้คุณได้พักจากหน้าจอ
            มาสบตาเพื่อนสนิท ยิ้มกับเพื่อนใหม่ และหัวเราะกับเพื่อนเก่า
            ผ่านตัวเลขบนลูกเต๋า
          </p>
          <p className="text-gray-600 leading-relaxed mb-8">
            บอร์ดเกมกว่า {gameCount} เกมพร้อมให้เลือกเล่น พร้อมทีมงานที่คอยแนะนำ
            อาหารและเครื่องดื่มคุณภาพดี สั่งได้ทันทีไม่ต้องรอนาน
          </p>

          {/* Stats */}
          <div className="flex gap-8 justify-center md:justify-start">
            <div className="text-center md:text-left">
              <p className="text-3xl font-bold text-orange tabular-nums">
                {inView ? `${games}+` : "0+"}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">บอร์ดเกม</p>
            </div>
            <div className="w-px bg-sand" />
            <div className="text-center md:text-left">
              <p className="text-3xl font-bold text-orange">15:00</p>
              <p className="text-sm text-gray-500 mt-0.5">เปิดทุกวัน</p>
            </div>
            <div className="w-px bg-sand" />
            <div className="text-center md:text-left">
              <p className="text-3xl font-bold text-orange">∞</p>
              <p className="text-sm text-gray-500 mt-0.5">ความสุข</p>
            </div>
          </div>
        </div>

        {/* Image */}
        <div className="flex justify-center">
          <div className="relative w-72 h-72 md:w-96 md:h-96 rounded-3xl bg-sand overflow-hidden shadow-2xl ring-4 ring-white/60">
            {aboutImg ? (
              <Image src={aboutImg} alt="เกี่ยวกับร้าน" fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sand to-cream p-8">
                <Image src="/DS-new-logo.png" alt="Dice Shop" width={260} height={120} className="object-contain" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
