"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { renderMarkdown } from "@/lib/game-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "เกมนี้เล่นยังไง?",
  "เซ็ตอัปเริ่มเกมยังไง?",
  "เงื่อนไขการชนะคืออะไร?",
];

export default function GameChat({ gameId, gameName }: { gameId: number; gameName: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");

    const history: Msg[] = [...messages, { role: "user", content: q }];
    // เพิ่ม bubble ผู้ช่วยว่างไว้รอ stream
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);

    try {
      const res = await fetch(`/api/games/${gameId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "เกิดข้อผิดพลาด");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: acc }]);
      }
    } catch (e) {
      setMessages([
        ...history,
        { role: "assistant", content: e instanceof Error ? e.message : "ขออภัยครับ ระบบมีปัญหาชั่วคราว" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* ปุ่มลอย */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-4 z-40 flex items-center gap-2 bg-orange text-white font-bold text-sm pl-3 pr-4 py-3 rounded-full shadow-lg shadow-orange/30 active:scale-95 transition-transform"
        >
          <MessageCircle size={20} />
          ถามวิธีเล่น
        </button>
      )}

      {/* แผงแชท */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end sm:p-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:w-[400px] h-[85vh] sm:h-[600px] bg-cream rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* หัว */}
            <div className="flex items-center gap-2.5 px-4 py-3 bg-navy text-white shrink-0">
              <div className="w-9 h-9 rounded-full bg-orange/90 flex items-center justify-center text-lg">🎲</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight">น้องลูกเต๋า</p>
                <p className="text-[11px] text-white/60 truncate">ผู้ช่วยสอน · {gameName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* ข้อความ */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
              {/* ทักทาย */}
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-sand flex items-center justify-center text-sm shrink-0">🎲</div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-navy shadow-sm max-w-[85%]">
                  สวัสดีครับ! ผมช่วยตอบคำถามเรื่องวิธีเล่น การเซ็ตอัป และกติกาของเกม <b>{gameName}</b> ได้เลยครับ
                  <span className="block text-[11px] text-gray-400 mt-1.5">* ตอบตามคู่มือที่ร้านบันทึกไว้เท่านั้น</span>
                </div>
              </div>

              {messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5 pl-9 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="flex items-center gap-1 text-xs bg-white border border-sand text-navy px-2.5 py-1.5 rounded-full hover:border-orange transition-colors"
                    >
                      <Sparkles size={11} className="text-orange" />
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="bg-orange text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-sand flex items-center justify-center text-sm shrink-0">🎲</div>
                    <div className="bg-white rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-navy shadow-sm max-w-[85%] min-w-[2.5rem]">
                      {m.content ? (
                        <div className="space-y-1.5 [&_p]:leading-relaxed">{renderMarkdown(m.content)}</div>
                      ) : (
                        <span className="inline-flex gap-1 py-1">
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
                        </span>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>

            {/* ช่องพิมพ์ */}
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-center gap-2 px-3 py-3 bg-white border-t border-sand shrink-0"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="พิมพ์คำถามเรื่องเกมนี้..."
                className="flex-1 bg-cream rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="w-10 h-10 rounded-full bg-orange text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform shrink-0"
              >
                <Send size={17} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
