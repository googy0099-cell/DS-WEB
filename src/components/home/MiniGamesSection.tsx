import Link from "next/link";

const GAMES = [
  {
    emoji: "🎰",
    name: "สุ่มดวง",
    desc: "ลุ้นโชคด้วยการหมุนสุ่ม — ใครจะได้ดาวนำโชค?",
    from: "from-orange-400",
    to: "to-yellow-400",
    shadow: "shadow-orange-400/40",
  },
  {
    emoji: "⚡",
    name: "แข่งความเร็ว",
    desc: "กดให้เร็วกว่าเพื่อน พิสูจน์ว่าใครตอบสนองเร็วสุด!",
    from: "from-blue-500",
    to: "to-cyan-400",
    shadow: "shadow-cyan-400/40",
  },
  {
    emoji: "🧠",
    name: "ทายใจ",
    desc: "อ่านใจคนตรงข้าม — เดาให้ถูกแล้วชนะ!",
    from: "from-pink-500",
    to: "to-purple-500",
    shadow: "shadow-purple-500/40",
  },
];

export default function MiniGamesSection() {
  return (
    <section className="py-16 px-4 bg-gradient-to-br from-purple-900 via-indigo-900 to-navy relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-10">
          <p className="text-purple-300 font-semibold text-sm uppercase tracking-widest mb-2">Play Now</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">มินิเกมส์</h2>
          <p className="text-white/60 text-sm max-w-sm mx-auto">รอเพื่อนอยู่? เล่นฟรีทันที ไม่ต้องดาวน์โหลด</p>
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-5 mb-8">
          {GAMES.map((g) => (
            <Link
              key={g.name}
              href="/play"
              className="group relative rounded-2xl p-3 md:p-6 flex flex-col items-center text-center gap-2 md:gap-4 hover:-translate-y-1 md:hover:-translate-y-2 transition-all duration-300 overflow-hidden"
            >
              {/* Card gradient bg */}
              <div className={`absolute inset-0 bg-gradient-to-br ${g.from} ${g.to} opacity-90 group-hover:opacity-100 transition-opacity`} />

              {/* Content */}
              <div className="relative z-10">
                <div className="text-3xl md:text-6xl mb-1 md:mb-3 drop-shadow-lg group-hover:scale-110 transition-transform duration-300 inline-block">
                  {g.emoji}
                </div>
                <h3 className="font-bold text-white text-xs md:text-lg leading-tight">{g.name}</h3>
                <p className="hidden md:block text-white/80 text-sm leading-relaxed mt-1.5">{g.desc}</p>
              </div>

              <span className="relative z-10 hidden md:inline-block bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
                เล่นเลย →
              </span>
              <span className="relative z-10 md:hidden text-white/90 text-xs font-semibold">
                เล่นเลย →
              </span>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/play"
            className="inline-block bg-white text-navy font-bold px-7 py-3 rounded-xl text-sm hover:bg-white/90 transition-colors shadow-lg"
          >
            ดูมินิเกมทั้งหมด →
          </Link>
        </div>
      </div>
    </section>
  );
}
