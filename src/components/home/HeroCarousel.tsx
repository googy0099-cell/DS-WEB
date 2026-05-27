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
  { bg: "from-navy to-navy/80", image: null, title: "", subtitle: "" },
  { bg: "from-orange/80 to-sand", image: null, title: "บรรยากาศอบอุ่น", subtitle: "พื้นที่พักผ่อนสำหรับทุกวัย" },
  { bg: "from-sage/80 to-cream", image: null, title: "เกมหลากหลาย", subtitle: "บอร์ดเกมกว่า 170 ชื่อ พร้อมให้เล่น" },
  { bg: "from-navy/90 to-orange/50", image: null, title: "อาหาร & เครื่องดื่ม", subtitle: "เมนูอร่อยสั่งได้ทันที ไม่ต้องรอนาน" },
];

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [textVisible, setTextVisible] = useState(true);

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
      setTextVisible(false);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % slides.length);
        setTextVisible(true);
      }, 400);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const goTo = (i: number) => {
    setTextVisible(false);
    setTimeout(() => { setCurrent(i); setTextVisible(true); }, 300);
  };

  return (
    <div id="hero" className="relative w-full h-[100vw] md:aspect-[2.35/1] md:h-auto overflow-hidden">
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === current ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {slide.image ? (
            <Image
              src={slide.image}
              alt={slide.title}
              fill
              className="object-cover scale-[1.03] transition-transform duration-[6000ms] ease-out"
              style={{ transform: i === current ? "scale(1)" : "scale(1.03)" }}
              priority={i === 0}
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${slide.bg ?? "from-navy to-navy/80"}`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-navy/20 to-transparent" />
        </div>
      ))}

      {/* Logo overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="drop-shadow-2xl">
          <Image
            src="/DS-new-logo.png"
            alt="Dice Shop"
            width={264}
            height={96}
            className="object-contain brightness-0 invert w-60 md:w-88 h-auto drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
            priority
          />
        </div>
      </div>

      {/* Slide text */}
      {slides[current]?.title && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-end pb-20 md:pb-28 px-4 text-center transition-all duration-400 ${
            textVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          <h2 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg mb-2">{slides[current].title}</h2>
          {slides[current].subtitle && (
            <p className="text-cream/90 text-sm md:text-lg drop-shadow">{slides[current].subtitle}</p>
          )}
        </div>
      )}

      {/* Dot indicators */}
      <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300 ${
              i === current ? "bg-orange w-6 h-3" : "bg-white/50 hover:bg-white/80 w-3 h-3"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
