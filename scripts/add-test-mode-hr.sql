-- โหมดทดสอบระบบ Phase 2: ครอบ HR (transactional tables)
-- ติดธง is_test ให้ข้อมูล HR ที่สร้างตอนโหมดทดสอบ (เช็คอิน, หักเงิน, เช็คลิสต์, งาน, KPI, นัดจ่าย)
-- ตาราง reference/config (staff, schedule, template, config) ไม่ติดธง — ให้โหมดทดสอบอ่านของจริง
-- additive ล้วน (default 0) — ของเดิมทั้งหมดเป็นข้อมูลจริง
-- รันก่อน deploy:
--   turso db shell dice-shop < scripts/add-test-mode-hr.sql
ALTER TABLE "hr_attendance"     ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "hr_deduction"      ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "hr_checklist"      ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "hr_checklist_item" ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "hr_task"           ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "hr_kpi"            ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "hr_payment_event"  ADD COLUMN "is_test" INTEGER NOT NULL DEFAULT 0;
