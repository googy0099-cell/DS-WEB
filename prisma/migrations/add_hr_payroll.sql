ALTER TABLE hr_staff ADD COLUMN base_salary INTEGER NOT NULL DEFAULT 0;

CREATE TABLE hr_deduction (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES hr_staff(id) ON DELETE CASCADE
);

CREATE INDEX hr_deduction_staff_year_month_idx ON hr_deduction(staff_id, year, month);
