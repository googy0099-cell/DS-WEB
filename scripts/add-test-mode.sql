-- โหมดทดสอบระบบ (Sandbox): ติดธง is_test ให้ข้อมูลที่สร้างตอนโหมดทดสอบ
-- ซ่อนจากยอด/รายงาน/แจ้งเตือนทุกที่ และลบทิ้งทีหลังได้ (ดู /api/test-mode/clear)
-- additive ล้วน (default 0) — ของเดิมทั้งหมดเป็นข้อมูลจริง
-- รันก่อน deploy:
--   turso db shell dice-shop < scripts/add-test-mode.sql
ALTER TABLE "Bill"              ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlayerSession"     ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order"             ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payment"           ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SplitPayment"      ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CashDrawerSession" ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Receipt"           ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CashExpense"       ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CashTopup"         ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
