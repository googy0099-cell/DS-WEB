-- เพิ่มฟิลด์ rulesTh สำหรับเก็บคู่มือกติกาละเอียดของแต่ละเกม (ใช้เป็นแหล่งอ้างอิงของแชทบอทผู้ช่วยสอนเกม)
-- รันด้วย: turso db shell dice-shop < prisma/add-game-rules.sql
-- จากนั้น: npx prisma generate
ALTER TABLE "GameGuide" ADD COLUMN "rulesTh" TEXT;
