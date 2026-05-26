import Link from "next/link";
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
            <div key={act.id} className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-3 hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
              <div className="flex items-start gap-3">
                <span className="text-3xl shrink-0">{act.emoji}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs bg-orange/10 text-orange px-2 py-0.5 rounded-full font-medium">
                    {act.tag}
                  </span>
                  <h3 className="font-bold text-navy mt-1.5 text-sm leading-tight">{act.title}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-orange font-semibold">
                <span>📅</span>
                <span>{act.date}</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed flex-1">{act.desc}</p>
            </div>
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

      {/* Mini game CTA */}
      <div className="max-w-5xl mx-auto mt-12">
        <div className="bg-navy rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          <div className="text-5xl shrink-0">🎲</div>
          <div className="flex-1">
            <h3 className="text-cream font-bold text-lg mb-1">รอเพื่อนอยู่? เล่นมินิเกมได้เลย!</h3>
            <p className="text-cream/70 text-sm">สุ่มดวง · แข่งความเร็ว · ทายใจ — เล่นฟรีไม่มีเงื่อนไข</p>
          </div>
          <Link
            href="/play"
            className="shrink-0 bg-orange text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-orange/90 transition-colors"
          >
            เล่นเลย →
          </Link>
        </div>
      </div>
    </section>
  );
}
