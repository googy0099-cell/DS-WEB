-- แบ่งจ่ายออเดอร์เดี่ยว: พักยอด "ส่วนเงินสด" ไว้บน Payment จนกว่าจะยืนยันรับเงิน
-- (เดิมบันทึก SplitPayment ตอนสแกน ถ้าลูกค้ายกเลิกก่อนจ่ายจะนับเป็นรายได้ค้าง)
-- รันก่อน deploy:
--   turso db shell dice-shop < scripts/add-split-cash-leg.sql
ALTER TABLE "Payment" ADD COLUMN "splitCashTHB" INTEGER;
