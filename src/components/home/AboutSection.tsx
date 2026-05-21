"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function AboutSection() {
  const [aboutImg, setAboutImg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/gallery?section=about")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setAboutImg(data[0].imageUrl);
      })
      .catch(() => {});
  }, []);

  return (
    <section id="about" className="py-16 px-4 bg-cream">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-orange font-semibold text-sm uppercase tracking-wider mb-2">เกี่ยวกับเรา</p>
          <h2 className="text-2xl md:text-2xl font-bold text-navy mb-4 leading-snug">
            พื้นที่สำหรับ<br />ทุกคน
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            เราไม่ได้แค่วางเกมไว้บนโต๊ะ
แต่เราสร้างพื้นที่ให้คุณได้พักจากหน้าจอเพื่อมาสบตาเพื่อนสนิท 
ได้ยิ้มกับเพื่อนใหม่ ได้หัวเราะกับเพื่อนเก่าผ่านตัวเลขบนลูกเต๋า
เป็นพื้นที่ที่เราจะไม่หวงความสุข เราพร้อมสร้างความสุขให้ทุกคนที่มาที่นี่
กับพวกเราร้านลูกเต๋า
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            บอร์ดเกมกว่า 200 เกมพร้อมให้เลือกเล่น พร้อมทีมงานที่คอยแนะนำวิธีเล่น
            อาหารและเครื่องดื่มคุณภาพดี สั่งได้ทันทีไม่ต้องรอนาน
          </p>
          <div className="flex gap-8">
            <div>
              <p className="text-2xl font-bold text-orange">200+</p>
              <p className="text-sm text-gray-500">บอร์ดเกม</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange">15:00</p>
              <p className="text-sm text-gray-500">เปิดทุกวัน</p>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="relative w-72 h-72 md:w-96 md:h-96 rounded-3xl bg-sand flex items-center justify-center shadow-xl overflow-hidden">
            {aboutImg ? (
              <Image src={aboutImg} alt="เกี่ยวกับร้าน" fill className="object-cover" />
            ) : (
              <Image
                src="/DS-new-logo.png"
                alt="Dice Shop"
                width={260}
                height={120}
                className="object-contain p-8"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
