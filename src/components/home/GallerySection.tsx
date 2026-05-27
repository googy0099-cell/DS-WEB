"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type GalleryItem = {
  id: number;
  imageUrl: string;
  caption: string | null;
};

const PLACEHOLDERS = [
  { gradient: "from-orange/30 to-sand", icon: "🎲", label: "บอร์ดเกม" },
  { gradient: "from-sage/40 to-cream", icon: "☕", label: "กาแฟ & เครื่องดื่ม" },
  { gradient: "from-navy/20 to-sand", icon: "🍜", label: "อาหาร" },
  { gradient: "from-orange/20 to-orange/5", icon: "👥", label: "กลุ่มเพื่อน" },
  { gradient: "from-sage/30 to-sage/10", icon: "🌙", label: "บรรยากาศยามค่ำ" },
  { gradient: "from-navy/30 to-navy/10", icon: "🏆", label: "กิจกรรม" },
];

export default function GallerySection() {
  const [items, setItems] = useState<GalleryItem[]>([]);

  useEffect(() => {
    fetch("/api/gallery?section=gallery")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
      })
      .catch(() => {});
  }, []);

  const showPlaceholders = items.length === 0;

  return (
    <section className="py-14 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-orange font-semibold text-sm uppercase tracking-wider mb-2">แกลเลอรี</p>
          <h2 className="text-2xl md:text-3xl font-bold text-navy">GALLERY</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {showPlaceholders
            ? PLACEHOLDERS.map((item, i) => (
                <div
                  key={i}
                  className={`aspect-[4/3] rounded-2xl bg-gradient-to-br ${item.gradient} flex flex-col items-center justify-center gap-2 shadow-sm`}
                >
                  <span className="text-4xl md:text-5xl">{item.icon}</span>
                  <p className="text-navy font-semibold text-sm">{item.label}</p>
                </div>
              ))
            : items.map((item) => (
                <div key={item.id} className="group aspect-[4/3] rounded-2xl overflow-hidden shadow-sm relative hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                  <Image
                    src={item.imageUrl}
                    alt={item.caption ?? "gallery"}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  {item.caption && (
                    <div className="absolute bottom-0 left-0 right-0 px-3 py-2 translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                      <p className="text-white text-xs font-medium">{item.caption}</p>
                    </div>
                  )}
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
