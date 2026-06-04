-- Add time limit and deduction tracking to checklist system
ALTER TABLE hr_checklist ADD COLUMN started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE hr_checklist ADD COLUMN deduction_applied INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS hr_checklist_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL UNIQUE,
  time_limit_minutes INTEGER,
  deduction_amount INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO hr_checklist_config (type, time_limit_minutes, deduction_amount) VALUES ('OPEN', NULL, 0);
INSERT OR IGNORE INTO hr_checklist_config (type, time_limit_minutes, deduction_amount) VALUES ('CLOSE', NULL, 0);
