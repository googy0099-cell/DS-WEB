-- HR Module tables (Phase 5)
-- Run: turso db shell dice-shop < prisma/hr_migration.sql

CREATE TABLE hr_staff (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL UNIQUE REFERENCES "User"(id),
  face_data TEXT,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE hr_attendance (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id   INTEGER NOT NULL REFERENCES hr_staff(id),
  check_in   DATETIME NOT NULL,
  check_out  DATETIME,
  photo_url  TEXT,
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE hr_checklist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL,
  date       DATETIME NOT NULL,
  staff_id   INTEGER NOT NULL REFERENCES hr_staff(id),
  created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE hr_checklist_item (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL REFERENCES hr_checklist(id),
  label        TEXT NOT NULL,
  done         INTEGER NOT NULL DEFAULT 0,
  photo_url    TEXT,
  done_at      DATETIME
);

CREATE TABLE hr_task (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'TODO',
  assigned_to INTEGER REFERENCES hr_staff(id),
  deadline    DATETIME,
  created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE hr_kpi (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL REFERENCES hr_staff(id),
  title    TEXT NOT NULL,
  target   REAL NOT NULL,
  actual   REAL NOT NULL DEFAULT 0,
  unit     TEXT NOT NULL,
  month    INTEGER NOT NULL,
  year     INTEGER NOT NULL
);
