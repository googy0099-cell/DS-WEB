// อัพโหลดรูปทุกใบที่ OCR จับคู่ได้ → Vercel Blob + อัพเดท Turso DB โดยตรง
import { put } from "@vercel/blob";
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { basename } from "path";

const BLOB_TOKEN  = "vercel_blob_rw_6QbWBJgjrW2CVlzt_KbEBAF3hdU4RP0XviXaq5slEDKbf0h";
const TURSO_URL   = "libsql://dice-shop-googy0099-cell.aws-ap-northeast-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzkzMzQ2NTYsImlkIjoiMDE5ZTQ4OWItZjIwMS03MzNlLTg4ODYtN2U1MDRhMDkyOGE1IiwicmlkIjoiNGQ3Y2ZmZDUtMjRiMi00N2I2LTk0NWYtOTE0NjA0MDM0MGI4In0.JmS6y_OSTjlpPjkJ-yen1mxaKCQ7YgQdUwFJov1d-qk-XamK6f2P3bP-8Ca9I0irwJxDzVmIGS7ogRZDxCqpDQ";
const MIN_SCORE   = 0.45;
const NO_BG_DIR   = "/Volumes/All Data/ฝากๆๆ/Looktao/บอร์ดเกม101/no-bg";

// ── แก้ mapping ที่ OCR ระบุผิด (จากการดูรูปด้วยตา) ──────────────────────
const OVERRIDES = {
  "20260522_222000.jpg": 74,   // Spyfall 2
  "20260522_224008.jpg": 78,   // Fire in the Hole
  "20260522_224417.jpg": 126,  // Bloodborne: The Board Game
  "20260522_230715.jpg": 66,   // Dead by Daylight
};

process.env.BLOB_READ_WRITE_TOKEN = BLOB_TOKEN;

const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

// โหลด mapping จาก OCR
const mapping = JSON.parse(readFileSync("/tmp/game_image_map.json", "utf8"));

// เอาเฉพาะที่ score >= MIN_SCORE หรือมี override
const candidates = mapping.filter(r =>
  OVERRIDES[r.file] || (r.score >= MIN_SCORE && r.game_id)
);

// ถ้ามีรูปซ้ำสำหรับ game เดียวกัน ให้เอาอันที่ score สูงสุด
const best = new Map(); // game_id → record
for (const r of candidates) {
  const gid = OVERRIDES[r.file] ?? r.game_id;
  if (!best.has(gid) || r.score > best.get(gid).score) {
    best.set(gid, { ...r, game_id: gid });
  }
}

console.log(`\nจะอัพโหลด ${best.size} รูป\n`);

let ok = 0, fail = 0;
for (const [gid, r] of best) {
  const filepath = `${NO_BG_DIR}/${r.file}`;
  try {
    // 1. อ่านไฟล์
    const fileBuffer = readFileSync(filepath);
    const filename   = `uploads/${basename(filepath)}`;

    // 2. อัพโหลดไปยัง Vercel Blob
    const blob = await put(filename, fileBuffer, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: true,
      token: BLOB_TOKEN,
    });

    // 3. อัพเดท DB
    await db.execute({
      sql: 'UPDATE "GameGuide" SET "imageUrl" = ? WHERE "id" = ?',
      args: [blob.url, gid],
    });

    console.log(`✓ [${gid}] ${r.game_name ?? "?"} ← ${r.file} (${r.score.toFixed(2)})`);
    ok++;
  } catch (e) {
    console.error(`✗ [${gid}] ${r.game_name ?? "?"} — ${e.message}`);
    fail++;
  }
}

console.log(`\nเสร็จ: ✓${ok}  ✗${fail}`);
db.close();
