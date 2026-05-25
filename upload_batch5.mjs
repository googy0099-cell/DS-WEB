// อัพโหลดรอบ 5 — แก้ไขรูปที่ OCR จับคู่ผิดในรอบ 1 และเพิ่มเกมที่หา match ได้
import { put } from "@vercel/blob";
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";

const BLOB_TOKEN  = "vercel_blob_rw_6QbWBJgjrW2CVlzt_KbEBAF3hdU4RP0XviXaq5slEDKbf0h";
const TURSO_URL   = "libsql://dice-shop-googy0099-cell.aws-ap-northeast-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzkzMzQ2NTYsImlkIjoiMDE5ZTQ4OWItZjIwMS03MzNlLTg4ODYtN2U1MDRhMDkyOGE1IiwicmlkIjoiNGQ3Y2ZmZDUtMjRiMi00N2I2LTk0NWYtOTE0NjA0MDM0MGI4In0.JmS6y_OSTjlpPjkJ-yen1mxaKCQ7YgQdUwFJov1d-qk-XamK6f2P3bP-8Ca9I0irwJxDzVmIGS7ogRZDxCqpDQ";
const NO_BG_DIR   = "/Volumes/All Data/ฝากๆๆ/Looktao/บอร์ดเกม101/no-bg";

// รายการแก้ไข: file → game_id ที่ถูกต้อง
// หมายเหตุ: บางรูปนี้อัพโหลดไปผิด game ในรอบ 1 แล้ว แต่ต้องการใช้ image เดิมกับ game ที่ถูกต้อง
const FIXES = [
  // 210750 = "SHERIFF OF NOTTINGHAM" → ถูกใช้ผิดใน batch1 สำหรับ ID 55 (Zombicide)
  { file: "20260522_210750.jpg", gameId: 49, reason: "OCR: SHERIFF OF NOTTINGHAM 2ND EDITION" },
  // 221309 = "ZOMBICIDE 2nd EDITION" → แก้ ID 55 (Zombicide) ที่มีรูปผิด
  { file: "20260522_221309.jpg", gameId: 55, reason: "OCR: ZOMBICIDE 2nd EDITION — fixes wrong photo" },
  // 223804 = "The Haunted Glass / ผีถ้วยแก้ว" → ถูกใช้ผิดใน batch1 สำหรับ ID 36 (Honeycomb Tree)
  { file: "20260522_223804.jpg", gameId: 52, reason: "OCR: The Haunted Glass (= Glass Ghost)" },
];

process.env.BLOB_READ_WRITE_TOKEN = BLOB_TOKEN;
const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

const gamesRes = await db.execute('SELECT id, "nameEn" FROM "GameGuide"');
const gameNames = new Map(gamesRes.rows.map(r => [Number(r.id), r.nameEn]));

console.log(`\nจะแก้ไข ${FIXES.length} รูป\n`);

let ok = 0, fail = 0;
for (const { file, gameId, reason } of FIXES) {
  const filepath = `${NO_BG_DIR}/${file}`;
  const gameName = gameNames.get(gameId) ?? "?";
  try {
    const fileBuffer = readFileSync(filepath);
    const blob = await put(`uploads/${file}`, fileBuffer, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: true,
      token: BLOB_TOKEN,
    });
    await db.execute({
      sql: 'UPDATE "GameGuide" SET "imageUrl" = ? WHERE "id" = ?',
      args: [blob.url, gameId],
    });
    console.log(`✓ [${gameId}] ${gameName} ← ${file}`);
    console.log(`  (${reason})`);
    ok++;
  } catch (e) {
    console.error(`✗ [${gameId}] ${gameName} — ${e.message}`);
    fail++;
  }
}

console.log(`\nเสร็จ: ✓${ok}  ✗${fail}`);
db.close();
