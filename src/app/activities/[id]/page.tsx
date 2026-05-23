import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const act = await db.activity.findUnique({
    where: { id: Number(id), isActive: true },
  });
  if (!act) notFound();

  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen bg-cream">
        {/* Cover image */}
        {act.imageUrl ? (
          <div className="relative w-full aspect-[2/1] max-h-72 overflow-hidden bg-sand">
            <Image src={act.imageUrl} alt={act.title} fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/60 to-transparent" />
          </div>
        ) : (
          <div className="w-full h-40 bg-navy flex items-center justify-center">
            <span className="text-6xl">{act.emoji}</span>
          </div>
        )}

        <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
          {/* Back */}
          <Link href="/activities" className="text-sm text-navy/50 hover:text-navy flex items-center gap-1">
            ← กิจกรรมทั้งหมด
          </Link>

          {/* Header */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs bg-orange/10 text-orange px-2.5 py-1 rounded-full font-semibold">
                {act.tag}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-navy leading-tight">
              {act.emoji} {act.title}
            </h1>
            <p className="text-orange font-semibold text-sm mt-2">{act.date}</p>
          </div>

          {/* Short desc */}
          {act.desc && (
            <p className="text-gray-600 text-base leading-relaxed border-l-4 border-orange/30 pl-4">
              {act.desc}
            </p>
          )}

          {/* Long content */}
          {act.content && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                {act.content}
              </p>
            </div>
          )}

          {/* Link button */}
          {act.link && (
            <a
              href={act.link}
              target={act.link.startsWith("http") ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="inline-block bg-orange text-white font-bold px-6 py-3 rounded-xl hover:bg-orange/90 transition-colors"
            >
              {act.linkLabel || "ดูรายละเอียดเพิ่มเติม →"}
            </a>
          )}

          <Link
            href="/activities"
            className="inline-block text-navy/50 text-sm hover:text-navy"
          >
            ← ดูกิจกรรมทั้งหมด
          </Link>
        </div>

        <Footer />
      </div>
    </>
  );
}
