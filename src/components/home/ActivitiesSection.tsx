import Link from "next/link";

const ACTIVITIES = [
  {
    emoji: "🎭",
    title: "คืน Werewolf สุดมันส์",
    date: "ทุกวันศุกร์ เวลา 19:00 น.",
    desc: "เข้าร่วมเล่น Werewolf กับคนแปลกหน้า สนุกมั้ย? ลองดู!",
    tag: "เกม",
  },
  {
    emoji: "🏆",
    title: "Tournament บอร์ดเกมประจำเดือน",
    date: "ทุกสิ้นเดือน",
    desc: "แข่งขัน Coup, Ticket to Ride ชิงของรางวัลและแต้มสะสม",
    tag: "การแข่งขัน",
  },
  {
    emoji: "☕",
    title: "Happy Hour เครื่องดื่ม",
    date: "ทุกวัน 15:00 – 17:00 น.",
    desc: "ซื้อ 1 แถม 1 เครื่องดื่มทุกรายการในช่วงเวลา Happy Hour",
    tag: "โปรโมชั่น",
  },
];

export default function ActivitiesSection() {
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
          {ACTIVITIES.map((act, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl">{act.emoji}</span>
                <div>
                  <span className="text-xs bg-orange/10 text-orange px-2 py-0.5 rounded-full font-medium">
                    {act.tag}
                  </span>
                  <h3 className="font-bold text-navy mt-1 text-sm leading-tight">{act.title}</h3>
                </div>
              </div>
              <p className="text-xs text-orange font-semibold">{act.date}</p>
              <p className="text-gray-500 text-sm leading-relaxed">{act.desc}</p>
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
    </section>
  );
}
