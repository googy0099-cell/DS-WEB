-- Add cancelled_at to OrderItem for soft-delete of in-kitchen items
ALTER TABLE "OrderItem" ADD COLUMN "cancelled_at" DATETIME;
