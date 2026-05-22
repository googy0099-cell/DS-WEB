"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type Slide = {
  bg?: string;
  image: string | null;
  title: string;
  subtitle: string;
};

const DEFAULT_SLIDES: Slide[] = [
  { bg: "from-navy to-navy/80", image: "/Web-ref.png", title: "ร้านเกมกระดาน", subtitle: "นั่งสบาย อาหารอร่อย เกมเพียบ" },
  { bg: "from-orange/80 to-sand", image: null, title: "บรรยากาศอบอุ่น", subtitle: "พื้นที่พักผ่อนสำหรับทุกวัย" },
  { bg: "from-sage/80 to-cream", image: null, title: "เกมหลากหลาย", subtitle: "บอร์ดเกมกว่า 50 ชื่อ พร้อมให้เล่น" },
  { bg: "from-navy/90 to-orange/50", image: null, title: "อาหาร & เครื่องดื่ม", subtitle: "เมนูอร่อยสั่งได้ทันที ไม่ต้องรอนาน" },
];

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);

  useEffect(() => {
    fetch("/api/gallery?section=hero")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const heroSlides: Slide[] = data.map((item: { imageUrl: string; caption: string | null }) => ({
            image: item.imageUrl,
            title: item.caption ?? "",
            subtitle: "",
          }));
          setSlides(heroSlides);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div id="hero" className="relative w-full h-[100vw] md:aspect-[2.35/1] md:h-auto overflow-hidden">
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        >
          {slide.image ? (
            <Image
              src={slide.image}
              alt={slide.title}
              fill
              className="object-cover"
              priority={i === 0}
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${slide.bg ?? "from-navy to-navy/80"}`} />
          )}
          <div className="absolute inset-0 bg-navy/40" />

          {slide.title && (
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-24 md:pb-32 px-4 text-center">
              <h2 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg mb-2">{slide.title}</h2>
              {slide.subtitle && <p className="text-cream/90 text-sm md:text-lg drop-shadow">{slide.subtitle}</p>}
            </div>
          )}
        </div>
      ))}

      {/* Logo overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="drop-shadow-2xl">
          <Image
            src="/DS-new-logo.png"
            alt="Dice Shop"
            width={220}
            height={80}
            className="object-contain brightness-0 invert w-48 md:w-72 h-auto"
            priority
          />
        </div>
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === current ? "bg-orange scale-125" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
