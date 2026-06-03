-- Add slug column to Table
ALTER TABLE "Table" ADD COLUMN "slug" TEXT;

-- Generate a unique 8-char hex slug for every existing table
UPDATE "Table" SET "slug" = lower(hex(randomblob(4))) WHERE "slug" IS NULL;

-- Unique index
CREATE UNIQUE INDEX "Table_slug_key" ON "Table"("slug");
