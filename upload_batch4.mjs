// อัพโหลดรอบ 4 — จากการวิเคราะห์ OCR รอบสุดท้าย
import { put } from "@vercel/blob";
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";

const BLOB_TOKEN  = "vercel_blob_rw_6QbWBJgjrW2CVlzt_KbEBAF3hdU4RP0XviXaq5slEDKbf0h";
const TURSO_URL   = "libsql://dice-shop-googy0099-cell.aws-ap-northeast-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzkzMzQ2NTYsImlkIjoiMDE5ZTQ4OWItZjIwMS03MzNlLTg4ODYtN2U1MDRhMDkyOGE1IiwicmlkIjoiNGQ3Y2ZmZDUtMjRiMi00N2I2LTk0NWYtOTE0NjA0MDM0MGI4In0.JmS6y_OSTjlpPjkJ-yen1mxaKCQ7YgQdUwFJov1d-qk-XamK6f2P3bP-8Ca9I0irwJxDzVmIGS7ogRZDxCqpDQ";
const NO_BG_DIR   = "/Volumes/All Data/ฝากๆๆ/Looktao/บอร์ดเกม101/no-bg";

// OVERRIDES รอบ 4 — เฉพาะที่มีหลักฐาน OCR
const OVERRIDES = {
  // HIGH CONFIDENCE
  "20260522_210947.jpg": 11,   // Dobble (OCR: "Blue Orange | Hot Games Cool Planet" = Spot It!/Dobble)
  // MEDIUM CONFIDENCE
  "20260522_205656.jpg": 75,   // Insider Black Edition (OCR: "INSIDPL" = INSIDER)
  // LOW CONFIDENCE
  "20260522_210934.jpg": 27,   // Stack (OCR: "INSTABIL" = unstable stacking game)
};

// รวม IDs ที่อัพโหลดแล้วทุก batch
const DONE_IDS = new Set([
  // Batch 1
  7,8,10,21,24,28,29,31,36,38,39,40,48,50,51,55,56,57,58,59,
  64,65,66,67,68,69,70,71,73,74,77,78,83,84,85,86,87,88,89,
  91,93,100,101,106,109,110,111,114,118,119,121,122,123,126,131,
  132,134,137,138,139,143,144,146,147,
  // Batch 2
  82,135,104,92,145,113,53,133,128,130,44,
  // Batch 3
  98,94,2,99,115,80,120,47,102,42,112,
]);

process.env.BLOB_READ_WRITE_TOKEN = BLOB_TOKEN;
const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

const gamesRes = await db.execute('SELECT id, "nameEn" FROM "GameGuide"');
const gameNames = new Map(gamesRes.rows.map(r => [Number(r.id), r.nameEn]));

console.log(`\nจะอัพโหลด ${Object.keys(OVERRIDES).length} รูป\n`);

let ok = 0, fail = 0;
for (const [file, gid] of Object.entries(OVERRIDES)) {
  if (DONE_IDS.has(gid)) {
    console.log(`⚠ skip [${gid}] ${gameNames.get(gid)} — already uploaded`);
    continue;
  }
  const filepath = `${NO_BG_DIR}/${file}`;
  const gameName = gameNames.get(gid) ?? "?";
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
      args: [blob.url, gid],
    });
    console.log(`✓ [${gid}] ${gameName} ← ${file}`);
    ok++;
  } catch (e) {
    console.error(`✗ [${gid}] ${gameName} — ${e.message}`);
    fail++;
  }
}

console.log(`\nเสร็จ: ✓${ok}  ✗${fail}`);
db.close();
