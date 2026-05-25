"use client";

export default function GMCanvasForYouPage() {
  return (
    <div className="fixed inset-0 bg-[#0d0d0d]">
      <iframe
        src="/werewolf-gm-canvas-foryou.html"
        className="w-full h-full border-0"
        allow="fullscreen"
        title="Werewolf Canvas GM for You"
      />
    </div>
  );
}
