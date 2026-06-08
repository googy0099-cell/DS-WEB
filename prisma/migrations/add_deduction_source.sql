-- HR: idempotency keys for auto-generated deductions (late / absent / task / checklist)
-- Run on Turso:  turso db shell dice-shop < prisma/migrations/add_deduction_source.sql
-- Then locally:  npx prisma generate

ALTER TABLE hr_deduction ADD COLUMN source_type TEXT;
ALTER TABLE hr_deduction ADD COLUMN source_id   TEXT;

-- Blocks duplicate auto-deductions for the same source.
-- Manual deductions keep (NULL, NULL); SQLite treats NULLs as distinct so they never collide.
CREATE UNIQUE INDEX IF NOT EXISTS hr_deduction_source_unique
  ON hr_deduction (source_type, source_id);
