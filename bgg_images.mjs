// ค้นหารูปจาก Wikipedia และ web sources สำหรับเกมที่ยังไม่มีรูป
import { put } from "@vercel/blob";
import { createClient } from "@libsql/client";

const BLOB_TOKEN  = "vercel_blob_rw_6QbWBJgjrW2CVlzt_KbEBAF3hdU4RP0XviXaq5slEDKbf0h";
const TURSO_URL   = "libsql://dice-shop-googy0099-cell.aws-ap-northeast-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzkzMzQ2NTYsImlkIjoiMDE5ZTQ4OWItZjIwMS03MzNlLTg4ODYtN2U1MDRhMDkyOGE1IiwicmlkIjoiNGQ3Y2ZmZDUtMjRiMi00N2I2LTk0NWYtOTE0NjA0MDM0MGI4In0.JmS6y_OSTjlpPjkJ-yen1mxaKCQ7YgQdUwFJov1d-qk-XamK6f2P3bP-8Ca9I0irwJxDzVmIGS7ogRZDxCqpDQ";

process.env.BLOB_READ_WRITE_TOKEN = BLOB_TOKEN;

const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Wikipedia article title mapping — ชื่อที่ใช้ในบทความ Wikipedia จริงๆ
const WIKI_TITLES = {
  "Coup":                           ["Coup (board game)"],
  "Codenames":                      ["Codenames (board game)"],
  "One Night Ultimate Werewolf":    ["One Night Ultimate Werewolf"],
  "Exploding Kitten":               ["Exploding Kittens"],
  "Exploding Kittens":              ["Exploding Kittens"],
  "Dobble":                         ["Spot It!"],
  "Connect Four":                   ["Connect Four"],
  "Guess Who?":                     ["Guess Who?"],
  "Chess":                          ["Chess"],
  "Quoridor":                       ["Quoridor"],
  "Taboo":                          ["Taboo (game)"],
  "Bingo":                          ["Bingo (American version)"],
  "Don't Mess With The Boss":       ["Don't Mess with the Boss"],
  "Camel Up":                       ["Camel Up (board game)"],
  "Betrayal at House on the Hill":  ["Betrayal at House on the Hill"],
  "Sheriff of Nottingham":          ["Sheriff of Nottingham (board game)"],
  "Insider Black Edition":          ["Insider (board game)"],
  "Taco Cat Goat Cheese Pizza":     ["Taco Cat Goat Cheese Pizza"],
  "King of Tokyo":                  ["King of Tokyo (board game)"],
  "Ca$h 'n Guns":                   ["Ca$h 'n Guns"],
  "Catan: Starfarers":              ["Starfarers of Catan"],
  "6 Nimmt!":                       ["6 Nimmt!"],
  "Dune: Imperium – Uprising":      ["Dune: Imperium"],
  "Paranormal Detectives":          ["Paranormal Detectives"],
  "La Granja":                      ["La Granja (board game)"],
  "Blood on the Clocktower":        ["Blood on the Clocktower"],
  "Muffin Time":                    ["Muffin Time (card game)"],
  "7 Wonders Architects":           ["7 Wonders Architects"],
  "Codenames: The Simpsons":        ["Codenames (board game)"],
  "Sitting Ducks":                  ["Sitting Ducks Gallery"],
  "Tinderblox":                     ["Tinderblox"],
  "Deadly Labyrinth":               ["Deadly Labyrinth (board game)", "Deadly Labyrinth"],
  "Who Did It?":                    ["Who Did It? (board game)", "Who Did It?"],
  "Cascadia":                       ["Cascadia (board game)"],
  "Stack":                          ["Stack (game)"],
  "Taboo Party 18+":                ["Taboo (game)"],
  "Taboo: Flirt Edition":           ["Taboo (game)"],
  "Taboo: Office Edition":          ["Taboo (game)"],
  "Kiri-Ai: The Duel":              ["Kiri-Ai: The Duel", "Kiri-Ai"],
  "Monster Hunters":                ["Monster Hunters"],
  "Critter Kitchen":                ["Critter Kitchen"],
  "Nocturne":                       ["Nocturne (board game)"],
  "7 Wonders Duel":                 ["7 Wonders Duel"],
};

// เกมที่เป็นของไทย/ไม่มีใน Wikipedia — ข้ามการค้นหาไปเลย
const SKIP_SEARCH = new Set([
  "Ghost Catcher", "Astronaut Balance", "Phi Khe", "Crazy Face Puzzle",
  "Who Is It?", "Chain Chess", "Number Flip", "XO", "Balance Puzzle",
  "Diamond Trade", "Crazy Scientist", "Penguin Protect Egg", "Glass Ghost",
  "Penguin Guard Egg", "Taboo Party 18+", "Taboo: Flirt Edition",
  "Taboo: Office Edition", "Taboo: Jum Meng", "Pacman", "Foosball Winner",
  "Shadow House Masquerade", "Dream Budget", "Extreme Battle", "Neko in Tokyo",
  "Toy Battle", "Combo Crazy", "Hit Plus", "Battle Royale", "The Madness Ritual",
  "Critter Kitchen", "Mozart's Last Song", "Nocturne", "Rose and Blood Sword",
  "WTK Three Kingdoms", "Kiri-Ai: The Duel", "Crazy Flush",
]);

// รูปที่รู้ URL โดยตรง
const DIRECT_IMAGES = {};

async function fetchWithRetry(url, opts = {}, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, { ...opts, signal: AbortSignal.timeout(8000) });
      if (resp.status === 429) { await sleep(5000); continue; }
      return resp;
    } catch (e) {
      if (i === retries - 1) return null;
      await sleep(1000);
    }
  }
  return null;
}

async function getWikiImage(wikiTitle) {
  const encoded = encodeURIComponent(wikiTitle);
  const r = await fetchWithRetry(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`);
  if (!r || !r.ok) return null;
  const d = await r.json();
  return d.originalimage?.source || d.thumbnail?.source?.replace(/\/\d+px-/, '/500px-') || null;
}

async function findImage(game) {
  // ข้ามเกมที่เป็นไทย/ไม่มีใน Wikipedia
  if (SKIP_SEARCH.has(game.nameEn)) return null;

  // ลอง direct image ก่อน
  if (DIRECT_IMAGES[game.nameEn]) return DIRECT_IMAGES[game.nameEn];

  // ลอง Wikipedia titles ที่ pre-defined
  const titles = WIKI_TITLES[game.nameEn] || [];
  for (const t of titles) {
    const img = await getWikiImage(t);
    await sleep(200);
    if (img) return img;
  }

  // ถ้าไม่มีใน WIKI_TITLES ให้ search Wikipedia 1 ครั้ง
  if (titles.length === 0) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(game.nameEn + ' board game')}&format=json&srlimit=2`;
    const sr = await fetchWithRetry(searchUrl);
    if (sr && sr.ok) {
      const sd = await sr.json();
      const results = sd.query?.search || [];
      if (results[0]) {
        const img = await getWikiImage(results[0].title);
        await sleep(200);
        if (img) return img;
      }
    }
  }

  return null;
}

// โหลดเกมที่ยังไม่มีรูป
const res = await db.execute(
  `SELECT id, "nameEn", "nameTh" FROM "GameGuide" WHERE "imageUrl" IS NULL OR "imageUrl" = '' ORDER BY id`
);
const games = res.rows.map(r => ({ id: Number(r.id), nameEn: String(r.nameEn || ''), nameTh: String(r.nameTh || '') }));
console.log(`\nเกมที่ยังไม่มีรูป: ${games.length} เกม\n`);

let ok = 0, fail = 0, notFound = 0;

for (const game of games) {
  try {
    const imageUrl = await findImage(game);

    if (!imageUrl) {
      console.log(`? [${game.id}] ${game.nameEn} — ไม่พบรูป`);
      notFound++;
      continue;
    }

    // ดาวน์โหลดรูป
    const imgResp = await fetchWithRetry(imageUrl);
    if (!imgResp || !imgResp.ok) {
      console.log(`✗ [${game.id}] ${game.nameEn} — ดาวน์โหลดไม่ได้: ${imageUrl.slice(0,60)}`);
      fail++;
      continue;
    }
    const imgBuffer = await imgResp.arrayBuffer();
    if (imgBuffer.byteLength < 1000) {
      console.log(`✗ [${game.id}] ${game.nameEn} — รูปเล็กเกินไป (${imgBuffer.byteLength} bytes)`);
      fail++;
      continue;
    }

    const ext = imageUrl.match(/\.(png|gif|svg|webp)(\?|$)/i)?.[1]?.toLowerCase() || 'jpg';
    const contentType = { png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' }[ext] || 'image/jpeg';

    const blob = await put(`uploads/wiki_${game.id}.${ext}`, Buffer.from(imgBuffer), {
      access: "public", contentType, addRandomSuffix: true, token: BLOB_TOKEN,
    });

    await db.execute({
      sql: 'UPDATE "GameGuide" SET "imageUrl" = ? WHERE "id" = ?',
      args: [blob.url, game.id],
    });

    console.log(`✓ [${game.id}] ${game.nameEn}`);
    ok++;

  } catch (e) {
    console.error(`✗ [${game.id}] ${game.nameEn} — ${e.message}`);
    fail++;
  }

  await sleep(400);
}

console.log(`\nเสร็จ: ✓${ok}  ✗${fail}  ?${notFound}(ไม่พบ)`);
db.close();
