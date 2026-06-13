-- เก็บ "เงินเปิดเก๊ะ" ลง shop_session เพื่อให้รอดข้ามเที่ยงคืน/ข้ามเครื่อง
-- เดิมเก็บแค่ localStorage ของเบราว์เซอร์ → พอข้ามวันแล้วเปิดหน้าปิดยอด ค่ากลายเป็น 0
-- รันก่อน deploy:
--   turso db shell dice-shop < scripts/add-opening-float.sql
ALTER TABLE "shop_session" ADD COLUMN "opening_float" INTEGER;
