import Link from "next/link";
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

        <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
          {activities.length === 0 ? (
            <p className="text-center text-gray-400 py-12">ยังไม่มีกิจกรรม</p>
          ) : (
            activities.map((act: typeof activities[0]) => (
              <div key={act.id} className="bg-white rounded-2xl p-5 shadow-sm flex gap-4 items-start">
                <span className="text-3xl shrink-0">{act.emoji}</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-bold text-navy">{act.title}</h3>
                    <span className="text-xs bg-orange/10 text-orange px-2 py-0.5 rounded-full font-medium">
                      {act.tag}
                    </span>
                  </div>
                  <p className="text-orange text-xs font-semibold mb-2">{act.date}</p>
                  <p className="text-gray-500 text-sm leading-relaxed">{act.desc}</p>
                </div>
              </div>
            ))
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
