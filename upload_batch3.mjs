// อัพโหลดรอบ 3 — จับคู่ที่เหลือจาก OCR analysis
import { put } from "@vercel/blob";
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";

const BLOB_TOKEN  = "vercel_blob_rw_6QbWBJgjrW2CVlzt_KbEBAF3hdU4RP0XviXaq5slEDKbf0h";
const TURSO_URL   = "libsql://dice-shop-googy0099-cell.aws-ap-northeast-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzkzMzQ2NTYsImlkIjoiMDE5ZTQ4OWItZjIwMS03MzNlLTg4ODYtN2U1MDRhMDkyOGE1IiwicmlkIjoiNGQ3Y2ZmZDUtMjRiMi00N2I2LTk0NWYtOTE0NjA0MDM0MGI4In0.JmS6y_OSTjlpPjkJ-yen1mxaKCQ7YgQdUwFJov1d-qk-XamK6f2P3bP-8Ca9I0irwJxDzVmIGS7ogRZDxCqpDQ";
const NO_BG_DIR   = "/Volumes/All Data/ฝากๆๆ/Looktao/บอร์ดเกม101/no-bg";

// OVERRIDES: รูปที่ OCR ระบุผิด — แก้ด้วยการวิเคราะห์ข้อความบนกล่อง
const OVERRIDES = {
  // HIGH CONFIDENCE (ชื่อเกม/ผู้ออกแบบชัดเจนจาก OCR)
  "20260522_205806.jpg": 98,    // 6 Nimmt! (OCR: "Wolfgang Kramer | nimm | AMIGO")
  "20260522_210900.jpg": 94,    // King of Tokyo (OCR: "MERARN GARFIELD | KING | TOKYC")
  "20260522_213043.jpg": 2,     // Codenames (OCR: "VLAADA CHVÁTIL | CGE | 2016")
  "20260522_230549.jpg": 99,    // Kiri-Ai: The Duel (OCR: "POCKET PARAGONS")
  "20260522_205433.jpg": 115,   // La Granja (OCR: "Odendahl | Granja | STRONGHOLD GAMES")
  "20260522_214235.jpg": 80,    // Tinderblox (OCR: "STEFFEN BOGEN | Pretzel Games")
  "20260522_224355.jpg": 120,   // Nocturne (OCR: "PETER C. HAYWARD | CARDBOARD ALCHEMY")
  // MEDIUM CONFIDENCE
  "20260522_221946.jpg": 47,    // Rose and Blood Sword (OCR: "Blade &RoSE | BOX BREW")
  "20260522_231418.jpg": 102,   // Dune: Imperium (OCR: "MPERIUM | PAUL DENNEN")
  // LOW CONFIDENCE (original match — ไม่มีหลักฐานขัดแย้ง)
  "20260522_213414.jpg": 42,    // Deadly Labyrinth (2-6 PLAYERS | 10-30 MIN)
  "20260522_205224.jpg": 112,   // Paranormal Detectives (original match score 0.35)
};

// เกมที่อัพโหลดแล้วในรอบก่อน — ไม่เขียนทับ (ยกเว้น override)
const PREV_BATCH_IDS = new Set([
  // Batch 1
  7, 8, 10, 21, 24, 28, 29, 31, 36, 38, 39, 40, 48, 50, 51, 55, 56, 57, 58, 59,
  64, 65, 66, 67, 68, 69, 70, 71, 73, 74, 77, 78, 83, 84, 85, 86, 87, 88, 89,
  91, 93, 100, 101, 106, 109, 110, 111, 114, 118, 119, 121, 122, 123, 126, 131,
  132, 134, 137, 138, 139, 143, 144, 146, 147,
  // Batch 2
  82, 135, 104, 92, 145, 113, 53, 133, 128, 130, 44,
]);

process.env.BLOB_READ_WRITE_TOKEN = BLOB_TOKEN;
const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

const mapping = JSON.parse(readFileSync("/tmp/remaining_map.json", "utf8"));

// กรองเฉพาะรูปที่มี override → game ที่ยังไม่มีรูป
const best = new Map();
for (const r of mapping) {
  if (!OVERRIDES[r.file]) continue; // ในรอบนี้เอาเฉพาะ override เท่านั้น
  const gid = OVERRIDES[r.file];
  if (PREV_BATCH_IDS.has(gid)) {
    console.log(`⚠ skip [${gid}] — already uploaded`);
    continue;
  }
  if (!best.has(gid)) best.set(gid, { ...r, game_id: gid });
}

// โหลดชื่อเกมจาก DB
const gamesRes = await db.execute('SELECT id, "nameEn" FROM "GameGuide"');
const gameNames = new Map(gamesRes.rows.map(r => [Number(r.id), r.nameEn]));

console.log(`\nจะอัพโหลด ${best.size} รูป\n`);

let ok = 0, fail = 0;
for (const [gid, r] of best) {
  const filepath = `${NO_BG_DIR}/${r.file}`;
  const gameName = gameNames.get(gid) ?? "?";
  try {
    const fileBuffer = readFileSync(filepath);
    const blob = await put(`uploads/${r.file}`, fileBuffer, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: true,
      token: BLOB_TOKEN,
    });
    await db.execute({
      sql: 'UPDATE "GameGuide" SET "imageUrl" = ? WHERE "id" = ?',
      args: [blob.url, gid],
    });
    console.log(`✓ [${gid}] ${gameName} ← ${r.file}`);
    ok++;
  } catch (e) {
    console.error(`✗ [${gid}] ${gameName} — ${e.message}`);
    fail++;
  }
}

console.log(`\nเสร็จ: ✓${ok}  ✗${fail}`);
db.close();
