ALTER TABLE hr_late_config ADD COLUMN absent_deduction_type TEXT NOT NULL DEFAULT 'FIXED';
ALTER TABLE hr_late_config ADD COLUMN task_deduction_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hr_late_config ADD COLUMN task_deduction_type TEXT NOT NULL DEFAULT 'FIXED';
