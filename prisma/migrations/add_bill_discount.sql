-- Add discount fields to Bill for tab-checkout promotions
ALTER TABLE "Bill" ADD COLUMN "discount_type"   TEXT;
ALTER TABLE "Bill" ADD COLUMN "discount_value"  INTEGER;
ALTER TABLE "Bill" ADD COLUMN "discount_amount" INTEGER;
ALTER TABLE "Bill" ADD COLUMN "discount_note"   TEXT;
