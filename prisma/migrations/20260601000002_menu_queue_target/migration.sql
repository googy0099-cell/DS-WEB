ALTER TABLE "MenuItem" ADD COLUMN "queue_target" TEXT NOT NULL DEFAULT 'kitchen';

-- Set bar for drink categories
UPDATE "MenuItem" SET "queue_target" = 'bar' WHERE "category" IN ('milktea', 'coffee', 'soda', 'drink');
