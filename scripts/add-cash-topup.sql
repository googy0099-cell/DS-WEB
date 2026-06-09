-- ระบบเติมเงินสดเข้าเก๊ะ (Cash Top-up)
-- เงินสดที่เอาใส่เก๊ะระหว่างวัน → เพิ่มยอดเงินที่ควรมีในเก๊ะตอนปิดร้าน (mirror ของ petty cash)
-- รันก่อน deploy การเปลี่ยนแปลงนี้:
--   turso db shell dice-shop < scripts/add-cash-topup.sql
CREATE TABLE IF NOT EXISTS "CashTopup" (
  "id"          INTEGER PRIMARY KEY AUTOINCREMENT,
  "amount"      INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "note"        TEXT,
  "photoUrl"    TEXT,
  "createdById" INTEGER,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
