import db from "@/lib/db";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = randomCode();
    const existing = await db.werewolfRoom.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("ไม่สามารถสร้าง room code ได้ กรุณาลองใหม่");
}
