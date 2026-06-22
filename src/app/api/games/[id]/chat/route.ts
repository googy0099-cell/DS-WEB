import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import db from "@/lib/db";

// ผู้ช่วยสอนเกม (RAG) — ตอบโดยอ้างอิงเฉพาะ "คู่มือเกม" ที่ร้านกรอกไว้เท่านั้น ห้ามเดา/แต่งกติกาเอง
export const runtime = "nodejs";

const MODEL = "gemini-2.5-flash";
const MAX_TURNS = 12; // จำกัดประวัติแชทกันยาวเกิน/ค่าใช้จ่ายบาน
const MAX_CHARS = 2000; // จำกัดความยาวข้อความต่อครั้ง

type ChatMsg = { role: "user" | "assistant"; content: string };

function buildSystemPrompt(g: {
  nameTh: string; nameEn: string; summaryTh: string; rulesTh: string | null;
  minPlayers: number; maxPlayers: number; durationMin: number;
}, manual: string): string {
  const name = g.nameEn ? `${g.nameTh} (${g.nameEn})` : g.nameTh;
  return `คุณคือ "น้องลูกเต๋า" ผู้ช่วยสอนบอร์ดเกมของร้าน คอยตอบคำถามลูกค้าเกี่ยวกับเกม "${name}"

กฎการตอบที่ต้องทำตามอย่างเคร่งครัด:
1. ใช้ข้อมูลจาก "คู่มือเกม" ด้านล่างเป็นแหล่งอ้างอิงเพียงแหล่งเดียวเท่านั้น ห้ามใช้ความรู้ภายนอกหรือเดา/แต่งกติกาขึ้นมาเองโดยเด็ดขาด
2. ถ้าคำถามไม่มีคำตอบอยู่ในคู่มือ หรือคู่มือไม่ได้ระบุรายละเอียดส่วนนั้นไว้ ให้ตอบตรงๆ ว่า "ขออภัยครับ เรื่องนี้ไม่ได้ระบุไว้ในคู่มือของร้าน แนะนำให้สอบถามพนักงานเพิ่มเติมนะครับ" — ห้ามเดาหรือเติมคำตอบจากความรู้ทั่วไป
3. ตอบเป็นภาษาไทย สุภาพ กระชับ เข้าใจง่าย เหมือนพนักงานสอนเกมที่อยู่หน้าโต๊ะ ลงท้ายด้วย "ครับ"
4. ถ้าเป็นขั้นตอนการเล่นหรือการเซ็ตอัป ให้ตอบเป็นข้อๆ ตามลำดับ
5. ตอบเฉพาะเรื่องที่เกี่ยวกับเกมนี้เท่านั้น ถ้าถูกถามเรื่องอื่นให้บอกว่าตอบได้เฉพาะเรื่องเกมนี้

ข้อมูลเบื้องต้น: ผู้เล่น ${g.minPlayers}-${g.maxPlayers} คน · เวลาประมาณ ${g.durationMin} นาที

===== คู่มือเกม =====
${manual}
=====================`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ระบบแชทยังไม่พร้อมใช้งาน (ยังไม่ได้ตั้งค่า GEMINI_API_KEY)" },
      { status: 503 },
    );
  }

  let body: { messages?: ChatMsg[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatMsg[] = incoming
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "ไม่พบคำถาม" }, { status: 400 });
  }

  const game = await db.gameGuide.findUnique({ where: { id: Number(id) } });
  if (!game) return Response.json({ error: "ไม่พบเกม" }, { status: 404 });

  const manual = (game.rulesTh?.trim() || game.summaryTh?.trim() || "");
  if (!manual) {
    // ไม่มีคู่มือ → ตอบตามตรงโดยไม่ต้องเรียกโมเดล (ประหยัดค่าใช้จ่าย)
    const msg = "ขออภัยครับ เกมนี้ยังไม่มีคู่มือวิธีเล่นในระบบ แนะนำให้สอบถามพนักงานที่ร้านนะครับ";
    return new Response(msg, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const ai = new GoogleGenAI({ apiKey });
  const system = buildSystemPrompt(game, manual);

  // แปลงประวัติแชทเป็นรูปแบบ contents ของ Gemini (assistant -> model)
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const res = await ai.models.generateContentStream({
          model: MODEL,
          contents,
          config: {
            systemInstruction: system,
            maxOutputTokens: 1024,
            thinkingConfig: { thinkingBudget: 0 }, // ปิด thinking เพื่อลดค่าใช้จ่าย/ความหน่วง
          },
        });
        for await (const chunk of res) {
          const text = chunk.text;
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        console.error("[game-chat] error:", err);
        controller.enqueue(encoder.encode("ขออภัยครับ ระบบแชทมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้งนะครับ"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
