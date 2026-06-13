-- ระบบแบ่งจ่าย (Split payment: เงินสดบางส่วน + โอนส่วนที่เหลือ)
-- เก็บ "ส่วนเงินสด" ของการแบ่งจ่ายเป็น record แยก ส่วน Payment ของออเดอร์เก็บ "ส่วนโอน" (PROMPTPAY)
-- ทำให้ยอดเงินสด/โอน และเงินในเก๊ะตรงกัน นับเป็นรายได้คู่กับ Payment ที่ยืนยันแล้ว (อิง confirmedAt)
-- รันก่อน deploy:
--   turso db shell dice-shop < scripts/add-split-payment.sql
CREATE TABLE IF NOT EXISTS "SplitPayment" (
  "id"          INTEGER PRIMARY KEY AUTOINCREMENT,
  "orderId"     INTEGER NOT NULL,
  "billId"      INTEGER,
  "amountTHB"   INTEGER NOT NULL,
  "confirmedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SplitPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id")
);
CREATE INDEX IF NOT EXISTS "SplitPayment_confirmedAt_idx" ON "SplitPayment" ("confirmedAt");
CREATE INDEX IF NOT EXISTS "SplitPayment_orderId_idx" ON "SplitPayment" ("orderId");
