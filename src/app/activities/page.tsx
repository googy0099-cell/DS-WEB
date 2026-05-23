import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const activities = await db.activity.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen bg-cream">
        <div className="bg-navy px-4 py-10 text-center">
          <h1 className="text-2xl font-bold text-cream mb-1">กิจกรรมและโปรโมชั่น</h1>
          <p className="text-cream/60 text-sm">อัพเดทล่าสุดจาก Dice Shop</p>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {activities.length === 0 ? (
            <p className="text-center text-gray-400 py-16">ยังไม่มีกิจกรรม</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activities.map((act) => (
                <Link
                  key={act.id}
                  href={`/activities/${act.id}`}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Cover image or emoji banner */}
                  <div className="relative h-44 bg-gradient-to-br from-navy/80 to-orange/40 flex items-center justify-center overflow-hidden">
                    {act.imageUrl ? (
                      <Image
                        src={act.imageUrl}
                        alt={act.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <span className="text-6xl drop-shadow">{act.emoji}</span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <span className="absolute bottom-3 left-3 text-xs bg-orange text-white px-2.5 py-1 rounded-full font-semibold">
                      {act.tag}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <p className="text-orange text-xs font-semibold mb-1">{act.date}</p>
                    <h3 className="font-bold text-navy text-base leading-tight mb-1 group-hover:text-orange transition-colors">
                      {act.title}
                    </h3>
                    <p className="text-gray-500 text-sm line-clamp-2">{act.desc}</p>
                    {(act.content || act.link) && (
                      <p className="text-orange text-xs font-semibold mt-2">
                        ดูรายละเอียด →
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="max-w-4xl mx-auto px-4 pb-12 text-center">
          <Link
            href="/"
            className="inline-block bg-navy text-cream font-bold px-6 py-3 rounded-xl hover:bg-navy/90 transition-colors"
          >
            ← กลับหน้าแรก
          </Link>
        </div>

        <Footer />
      </div>
    </>
  );
}
