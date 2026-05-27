import Link from "next/link";
import Image from "next/image";
import db from "@/lib/db";

const GRADIENTS = [
  { from: "from-orange-400", to: "to-yellow-400" },
  { from: "from-blue-500", to: "to-cyan-400" },
  { from: "from-pink-500", to: "to-purple-500" },
  { from: "from-green-400", to: "to-teal-400" },
  { from: "from-red-500", to: "to-orange-400" },
  { from: "from-purple-500", to: "to-indigo-400" },
];

export default async function MiniGamesSection() {
  const games = await db.miniGame.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (games.length === 0) return null;

  return (
    <section className="py-16 px-4 bg-gradient-to-br from-purple-900 via-indigo-900 to-navy relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-10">
          <p className="text-purple-300 font-semibold text-sm uppercase tracking-widest mb-2">Play Now</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">มินิเกมส์</h2>
          <p className="text-white/60 text-sm max-w-sm mx-auto">รอเพื่อนอยู่? เล่นฟรีทันที ไม่ต้องดาวน์โหลด</p>
        </div>

        <div className={`grid gap-3 md:gap-5 mb-8 ${games.length <= 3 ? "grid-cols-3" : "grid-cols-3 md:grid-cols-4"}`}>
          {games.map((g, i) => {
            const grad = GRADIENTS[i % GRADIENTS.length];
            return (
              <Link
                key={g.id}
                href={`/play/game/${g.id}`}
                className="group relative rounded-2xl overflow-hidden hover:-translate-y-1 md:hover:-translate-y-2 transition-all duration-300"
              >
                {g.coverUrl ? (
                  <>
                    <div className="relative w-full aspect-square md:aspect-[4/3]">
                      <Image src={g.coverUrl} alt={g.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 md:p-4">
                      <p className="font-bold text-white text-xs md:text-base leading-tight">{g.name}</p>
                      <p className="text-white/80 text-xs mt-0.5 hidden md:block">เล่นเลย →</p>
                    </div>
                    <p className="absolute bottom-2 right-2 text-white/80 text-xs md:hidden">→</p>
                  </>
                ) : (
                  <div className={`bg-gradient-to-br ${grad.from} ${grad.to} p-3 md:p-6 flex flex-col items-center text-center gap-1 md:gap-4`}>
                    <span className="text-3xl md:text-5xl">🎮</span>
                    <p className="font-bold text-white text-xs md:text-base leading-tight">{g.name}</p>
                    <span className="text-white/80 text-xs md:text-sm">เล่นเลย →</span>
                  </div>
                )}
              </Link>
            );
          })}
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
