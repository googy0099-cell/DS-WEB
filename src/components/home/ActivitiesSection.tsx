import Link from "next/link";
import Image from "next/image";
import db from "@/lib/db";

export default async function ActivitiesSection() {
  const activities = await db.activity.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: 3,
  });

  return (
    <section id="activities" className="py-16 px-4 bg-sand/40">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-orange font-semibold text-sm uppercase tracking-wider mb-1">อัพเดท</p>
            <h2 className="text-2xl md:text-3xl font-bold text-navy">กิจกรรมและโปรโมชั่น</h2>
          </div>
          <Link href="/activities" className="text-orange font-semibold text-sm hover:underline shrink-0">
            ดูทั้งหมด →
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {activities.map((act) => (
            <Link
              key={act.id}
              href={`/activities/${act.id}`}
              className="rounded-2xl overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200 block"
            >
              {act.imageUrl ? (
                <div className="relative w-full aspect-[16/5]">
                  <Image src={act.imageUrl} alt={act.title} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-full aspect-[16/5] bg-gradient-to-br from-orange/20 to-sand flex items-center justify-center">
                  <span className="text-4xl">{act.emoji}</span>
                </div>
              )}
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/activities"
            className="inline-block bg-navy text-cream font-bold px-6 py-3 rounded-xl text-sm hover:bg-navy/90 transition-colors"
          >
            ดูกิจกรรมทั้งหมด →
          </Link>
        </div>
      </div>
    </section>
  );
}
