"use client";

export default function WerewolfCanvasPage() {
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <a
        href="/admin/werewolf"
        className="absolute top-3 left-3 z-10 bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-black/80 transition-colors"
      >
        ← กลับ
      </a>
      <iframe
        src="/werewolf-gm-canvas.html"
        className="w-full h-full border-0"
        allow="autoplay"
        title="Werewolf GM Canvas"
      />
    </div>
  );
}
