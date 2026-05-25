// อัพโหลดรูปรอบสอง — จาก /tmp/remaining_map.json
import { put } from "@vercel/blob";
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { basename } from "path";

const BLOB_TOKEN  = "vercel_blob_rw_6QbWBJgjrW2CVlzt_KbEBAF3hdU4RP0XviXaq5slEDKbf0h";
const TURSO_URL   = "libsql://dice-shop-googy0099-cell.aws-ap-northeast-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzkzMzQ2NTYsImlkIjoiMDE5ZTQ4OWItZjIwMS03MzNlLTg4ODYtN2U1MDRhMDkyOGE1IiwicmlkIjoiNGQ3Y2ZmZDUtMjRiMi00N2I2LTk0NWYtOTE0NjA0MDM0MGI4In0.JmS6y_OSTjlpPjkJ-yen1mxaKCQ7YgQdUwFJov1d-qk-XamK6f2P3bP-8Ca9I0irwJxDzVmIGS7ogRZDxCqpDQ";
const MIN_SCORE   = 0.45;
const NO_BG_DIR   = "/Volumes/All Data/ฝากๆๆ/Looktao/บอร์ดเกม101/no-bg";

// OCR ระบุผิด — override ด้วยการดูจากข้อความบนกล่อง
const OVERRIDES = {
  "20260522_210728.jpg": 135,  // Pandemic (Matt Leacock)
  "20260522_214148.jpg": 104,  // Cascadia (Randy Flynn, SDJ 2022)
  "20260522_214315.jpg": 92,   // Survive: Escape from Atlantis! ("SURVIVE THE ISLAND")
  "20260522_214503.jpg": 145,  // Clank! (Paul Dennen + Catacombs)
  "20260522_205751.jpg": 82,   // Elevator Chaos ("In Front of the Elevator")
  "20260522_221737.jpg": 113,  // WTK Three Kingdoms ("WTK" ใน OCR)
  "20260522_221837.jpg": 53,   // Mystic Market ("Mystic Market | Craft Your Fortune! | ThinkFun")
  "20260522_223856.jpg": 133,  // Unmatched ("UNMATCHED | Rob Daviau")
  "20260522_230732.jpg": 128,  // Harry Potter Board Game (Hogwarts)
  "20260522_230749.jpg": 128,  // Harry Potter Board Game (Hogwarts+)
  "20260522_230800.jpg": 128,  // Harry Potter Board Game (Harry Potter Hogwarts Battle)
  "20260522_231007.jpg": 130,  // Dracula vs Van Helsing
  "20260522_231343.jpg": 44,   // Root (Cole Wehrle + Kyle Ferrin)
};

// เกมที่อัพโหลดแล้วในรอบแรก — ไม่เขียนทับ
const FIRST_BATCH_IDS = new Set([
  7, 8, 10, 21, 24, 28, 29, 31, 36, 38, 39, 40, 48, 50, 51, 55, 56, 57, 58, 59,
  64, 65, 66, 67, 68, 69, 70, 71, 73, 74, 77, 78, 83, 84, 85, 86, 87, 88, 89,
  91, 93, 100, 101, 106, 109, 110, 111, 114, 118, 119, 121, 122, 123, 126, 131,
  132, 134, 137, 138, 139, 143, 144, 146, 147
]);

process.env.BLOB_READ_WRITE_TOKEN = BLOB_TOKEN;

const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
const mapping = JSON.parse(readFileSync("/tmp/remaining_map.json", "utf8"));

// เอาเฉพาะที่ override หรือ score >= MIN_SCORE ที่ยังไม่มีรูป
const candidates = mapping.filter(r => {
  const gid = OVERRIDES[r.file] ?? r.game_id;
  if (!gid) return false;
  if (FIRST_BATCH_IDS.has(gid) && !OVERRIDES[r.file]) return false; // ไม่เขียนทับรอบแรก ยกเว้น override
  if (!OVERRIDES[r.file] && r.score < MIN_SCORE) return false;
  return true;
});

// ถ้ามีรูปซ้ำสำหรับ game เดียวกัน ให้เอาอันที่ score สูงสุด
const best = new Map();
for (const r of candidates) {
  const gid = OVERRIDES[r.file] ?? r.game_id;
  if (!best.has(gid) || r.score > best.get(gid).score) {
    best.set(gid, { ...r, game_id: gid });
  }
}

console.log(`\nจะอัพโหลด ${best.size} รูป\n`);

// โหลด game names จาก DB เพื่อแสดง log
const gamesRes = await db.execute('SELECT id, "nameEn" FROM "GameGuide"');
const gameNames = new Map(gamesRes.rows.map(r => [Number(r.id), r.nameEn]));

let ok = 0, fail = 0;
for (const [gid, r] of best) {
  const filepath = `${NO_BG_DIR}/${r.file}`;
  const gameName = gameNames.get(gid) ?? "?";
  try {
    const fileBuffer = readFileSync(filepath);
    const filename   = `uploads/${basename(filepath)}`;

    const blob = await put(filename, fileBuffer, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: true,
      token: BLOB_TOKEN,
    });

    await db.execute({
      sql: 'UPDATE "GameGuide" SET "imageUrl" = ? WHERE "id" = ?',
      args: [blob.url, gid],
    });

    console.log(`✓ [${gid}] ${gameName} ← ${r.file} (${r.score.toFixed(2)})`);
    ok++;
  } catch (e) {
    console.error(`✗ [${gid}] ${gameName} — ${e.message}`);
    fail++;
  }
}

console.log(`\nเสร็จ: ✓${ok}  ✗${fail}`);
db.close();
