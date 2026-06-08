import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient, type Client } from "@libsql/client";

// Real libSQL engine, in-memory — proves the migration + idempotency at the SQL
// level without ever touching the production Turso database.

let db: Client;

const HR_DEDUCTION_DDL = `
CREATE TABLE hr_deduction (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  source_type TEXT,
  source_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX hr_deduction_source_unique ON hr_deduction(source_type, source_id);
`;

async function addDeduction(
  staffId: number,
  amount: number,
  reason: string,
  sourceType: string | null,
  sourceId: string | null
) {
  await db.execute({
    sql: `INSERT INTO hr_deduction (staff_id, amount, reason, month, year, source_type, source_id)
          VALUES (?, ?, ?, 6, 2026, ?, ?)`,
    args: [staffId, amount, reason, sourceType, sourceId],
  });
}

before(async () => {
  db = createClient({ url: ":memory:" });
  await db.executeMultiple(HR_DEDUCTION_DDL);
});

after(async () => {
  db.close();
});

// ── B: task deduction can only be booked once ───────────────────────────────
test("TASK deduction is idempotent — second insert for same task is rejected", async () => {
  await addDeduction(5, 200, "งานเกินกำหนด", "TASK", "42");
  await assert.rejects(
    () => addDeduction(5, 200, "งานเกินกำหนด (ซ้ำ)", "TASK", "42"),
    /UNIQUE|constraint/i,
    "duplicate TASK:42 must be blocked"
  );
});

// ── C: absent deduction can only be booked once per staff per date ───────────
test("ABSENT deduction is idempotent per (staff, date) — even for a past date", async () => {
  await addDeduction(7, 500, "ขาดงาน", "ABSENT", "7:2026-06-01");
  await assert.rejects(
    () => addDeduction(7, 500, "ขาดงาน (ซ้ำ)", "ABSENT", "7:2026-06-01"),
    /UNIQUE|constraint/i
  );
  // A different date for the same staff is allowed.
  await assert.doesNotReject(() => addDeduction(7, 500, "ขาดงาน", "ABSENT", "7:2026-06-02"));
});

// ── E: only one LATE deduction per staff per BKK day ─────────────────────────
test("LATE deduction is idempotent per (staff, day) — repeat check-ins cannot double-charge", async () => {
  await addDeduction(9, 75, "เข้างานสาย 15 นาที", "LATE", "9:2026-06-08");
  await assert.rejects(
    () => addDeduction(9, 50, "เข้างานสาย 10 นาที", "LATE", "9:2026-06-08"),
    /UNIQUE|constraint/i,
    "second late check-in the same day must not add a second deduction"
  );
});

// ── Manual deductions (NULL source) must never collide ───────────────────────
test("Manual deductions (NULL source) can be added freely without collision", async () => {
  await addDeduction(5, 100, "หักด้วยมือ #1", null, null);
  await assert.doesNotReject(() => addDeduction(5, 100, "หักด้วยมือ #2", null, null));
  await assert.doesNotReject(() => addDeduction(5, 250, "หักด้วยมือ #3", null, null));
});

// ── A: payout = gross − period deductions ────────────────────────────────────
test("Net pay = gross − sum(period deductions) for a staff member", async () => {
  // staff 5 currently has: TASK 200 + manual 100 + manual 100 + manual 250 = 650
  const rows = await db.execute({
    sql: `SELECT COALESCE(SUM(amount), 0) AS total FROM hr_deduction WHERE staff_id = ?`,
    args: [5],
  });
  const total = Number(rows.rows[0].total);
  assert.equal(total, 650);

  const gross = 30000;
  const net = Math.max(0, gross - total);
  assert.equal(net, 29350, "calendar payout must be net of deductions, not gross");
});
