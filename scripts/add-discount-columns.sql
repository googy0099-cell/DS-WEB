-- Persist single-order / receipt discount so receipts & the order queue can
-- show "ยอดรวม → ส่วนลด → สุทธิ" consistently across all channels.
-- Run BEFORE deploying this change:
--   turso db shell dice-shop < scripts/add-discount-columns.sql
ALTER TABLE "Order" ADD COLUMN discountAmount INTEGER;
ALTER TABLE Receipt ADD COLUMN discountAmount INTEGER;
