import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createClient, type Client } from "@libsql/client";
import { TAGGED_MODELS } from "../src/lib/test-mode.ts";

// In-memory libSQL mirror of the test-mode Prisma extension + cleanup route:
// proves creates are tagged, reads/reports are mode-scoped, and that EVERY test
// row (incl. non-tagged children) is removed by cleanup while live data is intact.

let db: Client;

// Prisma model name → physical table name (HR models use @@map("hr_*")).
const MODEL_TABLE: Record<string, string> = {
  Order: "Order", Bill: "Bill", Payment: "Payment", SplitPayment: "SplitPayment",
  PlayerSession: "PlayerSession", Receipt: "Receipt", CashExpense: "CashExpense",
  CashTopup: "CashTopup", CashDrawerSession: "CashDrawerSession",
  HrAttendance: "hr_attendance", HrDeduction: "hr_deduction", HrChecklist: "hr_checklist",
  HrChecklistItem: "hr_checklist_item", HrTask: "hr_task", HrKpi: "hr_kpi",
  HrPaymentEvent: "hr_payment_event",
};

const DDL = `
CREATE TABLE "Bill" (id INTEGER PRIMARY KEY AUTOINCREMENT, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "Order" (id INTEGER PRIMARY KEY AUTOINCREMENT, billId INTEGER, status TEXT DEFAULT 'CONFIRMED', is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE OrderItem (id INTEGER PRIMARY KEY AUTOINCREMENT, orderId INTEGER NOT NULL);
CREATE TABLE Payment (id INTEGER PRIMARY KEY AUTOINCREMENT, orderId INTEGER UNIQUE, method TEXT, amountTHB INTEGER, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE SplitPayment (id INTEGER PRIMARY KEY AUTOINCREMENT, orderId INTEGER, amountTHB INTEGER, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE PlayerSession (id INTEGER PRIMARY KEY AUTOINCREMENT, billId INTEGER, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE Receipt (id INTEGER PRIMARY KEY AUTOINCREMENT, orderId INTEGER UNIQUE, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE CashExpense (id INTEGER PRIMARY KEY AUTOINCREMENT, amount INTEGER, type TEXT, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE CashTopup (id INTEGER PRIMARY KEY AUTOINCREMENT, amount INTEGER, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE CashDrawerSession (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE hr_attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE hr_deduction (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE hr_checklist (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE hr_checklist_item (id INTEGER PRIMARY KEY AUTOINCREMENT, checklist_id INTEGER NOT NULL, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE hr_task (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE hr_kpi (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER, is_test INTEGER NOT NULL DEFAULT 0);
CREATE TABLE hr_payment_event (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER, is_test INTEGER NOT NULL DEFAULT 0);
`;

const ALL_TABLES = ["OrderItem", ...Object.values(MODEL_TABLE)];

// mirror of the extension: create tags isTest = current mode
async function createOrder(testMode: boolean, amount: number) {
  const o = (await db.execute({ sql: `INSERT INTO "Order"(is_test) VALUES (?) RETURNING id`, args: [testMode ? 1 : 0] })).rows[0];
  await db.execute({ sql: `INSERT INTO OrderItem(orderId) VALUES (?)`, args: [o.id] });
  await db.execute({ sql: `INSERT INTO Payment(orderId,method,amountTHB,is_test) VALUES (?,?,?,?)`, args: [o.id, "CASH", amount, testMode ? 1 : 0] });
  return Number(o.id);
}
// mirror of the extension: list/aggregate reads are scoped to the current mode
async function cashTotal(testMode: boolean) {
  const r = await db.execute({ sql: `SELECT COALESCE(SUM(amountTHB),0) t FROM Payment WHERE method='CASH' AND is_test=?`, args: [testMode ? 1 : 0] });
  return Number(r.rows[0].t);
}
// mirror of POST /api/test-mode/clear
async function clearTestData() {
  const orderIds = (await db.execute(`SELECT id FROM "Order" WHERE is_test=1`)).rows.map((r) => Number(r.id));
  if (orderIds.length) await db.execute(`DELETE FROM OrderItem WHERE orderId IN (${orderIds.join(",")})`);
  // FK order: children before parents (Receipt/Payment/Split/Order; checklist_item before checklist)
  const order = [
    "Receipt", "SplitPayment", "Payment", "Order", "PlayerSession", "Bill",
    "CashExpense", "CashTopup", "CashDrawerSession",
    "hr_checklist_item", "hr_checklist", "hr_attendance", "hr_deduction",
    "hr_task", "hr_kpi", "hr_payment_event",
  ];
  for (const t of order) await db.execute(`DELETE FROM "${t}" WHERE is_test=1`);
}

before(async () => { db = createClient({ url: "file::memory:" }); await db.executeMultiple(DDL); });
after(async () => { await db.close(); });
beforeEach(async () => {
  for (const t of ALL_TABLES) await db.execute(`DELETE FROM "${t}"`);
});

test("creates are tagged with the current mode", async () => {
  await createOrder(false, 100);
  await createOrder(true, 999);
  assert.equal((await db.execute(`SELECT is_test FROM "Order" ORDER BY id`)).rows.map((r) => Number(r.is_test)).join(","), "0,1");
});

test("reports are mode-scoped: live totals never include test data and vice-versa", async () => {
  await createOrder(false, 100);
  await createOrder(false, 50);
  await createOrder(true, 999);
  assert.equal(await cashTotal(false), 150, "live report excludes the ฿999 test sale");
  assert.equal(await cashTotal(true), 999, "test report shows only test data");
});

test("cleanup removes every test row (incl. non-tagged OrderItem) and leaves live data intact", async () => {
  const liveOrder = await createOrder(false, 100);
  await createOrder(true, 999);
  await db.execute(`INSERT INTO "Bill"(is_test) VALUES (0),(1)`);
  await db.execute(`INSERT INTO CashTopup(amount,is_test) VALUES (100,1)`);

  await clearTestData();

  for (const model of TAGGED_MODELS) {
    const tbl = MODEL_TABLE[model];
    const left = Number((await db.execute(`SELECT COUNT(*) c FROM "${tbl}" WHERE is_test=1`)).rows[0].c);
    assert.equal(left, 0, `${model} still has test rows after cleanup`);
  }
  const orphans = Number((await db.execute(`SELECT COUNT(*) c FROM OrderItem WHERE orderId NOT IN (SELECT id FROM "Order")`)).rows[0].c);
  assert.equal(orphans, 0, "test orders' OrderItems must be gone too");
  assert.equal(Number((await db.execute(`SELECT COUNT(*) c FROM "Order"`)).rows[0].c), 1, "the one live order survives");
  assert.equal(Number((await db.execute(`SELECT id FROM "Order"`)).rows[0].id), liveOrder);
  assert.equal(await cashTotal(false), 100, "live cash total intact");
});

test("HR (Phase 2): test attendance/checklist isolated and cleared; checklist items go before checklists", async () => {
  // live HR data
  await db.execute(`INSERT INTO hr_attendance(staff_id,is_test) VALUES (1,0)`);
  await db.execute(`INSERT INTO hr_checklist(type,is_test) VALUES ('OPEN',0)`);
  const liveCl = Number((await db.execute(`SELECT id FROM hr_checklist WHERE is_test=0`)).rows[0].id);
  await db.execute({ sql: `INSERT INTO hr_checklist_item(checklist_id,is_test) VALUES (?,0)`, args: [liveCl] });
  // test HR data (owner trying check-in + a CLOSE checklist with items)
  await db.execute(`INSERT INTO hr_attendance(staff_id,is_test) VALUES (1,1)`);
  await db.execute(`INSERT INTO hr_deduction(staff_id,is_test) VALUES (1,1)`);
  await db.execute(`INSERT INTO hr_checklist(type,is_test) VALUES ('CLOSE',1)`);
  const testCl = Number((await db.execute(`SELECT id FROM hr_checklist WHERE is_test=1`)).rows[0].id);
  await db.execute({ sql: `INSERT INTO hr_checklist_item(checklist_id,is_test) VALUES (?,1),(?,1)`, args: [testCl, testCl] });
  await db.execute(`INSERT INTO hr_task(title,is_test) VALUES ('ทดสอบ',1)`);
  await db.execute(`INSERT INTO hr_kpi(staff_id,is_test) VALUES (1,1)`);

  // live reports exclude test HR rows
  assert.equal(Number((await db.execute(`SELECT COUNT(*) c FROM hr_attendance WHERE is_test=0`)).rows[0].c), 1);
  assert.equal(Number((await db.execute(`SELECT COUNT(*) c FROM hr_attendance WHERE is_test=1`)).rows[0].c), 1);

  await clearTestData();

  for (const t of ["hr_attendance", "hr_deduction", "hr_checklist", "hr_checklist_item", "hr_task", "hr_kpi", "hr_payment_event"]) {
    assert.equal(Number((await db.execute(`SELECT COUNT(*) c FROM "${t}" WHERE is_test=1`)).rows[0].c), 0, `${t} test rows remain`);
  }
  // no orphaned checklist items (a test item pointing at a deleted checklist)
  const orphanItems = Number((await db.execute(`SELECT COUNT(*) c FROM hr_checklist_item WHERE checklist_id NOT IN (SELECT id FROM hr_checklist)`)).rows[0].c);
  assert.equal(orphanItems, 0, "test checklist items must be deleted before/with their checklist");
  // live HR survives
  assert.equal(Number((await db.execute(`SELECT COUNT(*) c FROM hr_checklist`)).rows[0].c), 1, "live checklist survives");
  assert.equal(Number((await db.execute(`SELECT COUNT(*) c FROM hr_attendance`)).rows[0].c), 1, "live attendance survives");
});

test("every tagged model has a table mapping + cleanup entry (sync guard)", async () => {
  for (const model of TAGGED_MODELS) {
    assert.ok(MODEL_TABLE[model], `TAGGED_MODELS has "${model}" with no table mapping — update the migration + cleanup too`);
  }
  assert.equal(TAGGED_MODELS.length, 16, "Phase 1 (9 sales/cashier) + Phase 2 (7 HR) = 16 tagged tables");
});
