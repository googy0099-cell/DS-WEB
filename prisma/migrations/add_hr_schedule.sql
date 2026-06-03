CREATE TABLE hr_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  grace_minutes INTEGER NOT NULL DEFAULT 10,
  FOREIGN KEY (staff_id) REFERENCES hr_staff(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX hr_schedule_staff_day_unique ON hr_schedule(staff_id, day_of_week);
ALTER TABLE hr_attendance ADD COLUMN check_in_status TEXT;
ALTER TABLE hr_attendance ADD COLUMN check_out_status TEXT;
