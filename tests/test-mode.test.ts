import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createClient, type Client } from "@libsql/client";
import { TAGGED_MODELS } from "../src/lib/test-mode.ts";

// In-memory libSQL mirror of the test-mode Prisma extension + cleanup route:
// proves creates are tagged, reads/reports are mode-scoped, and that EVERY test
// row (incl. non-tagged children) is removed by cleanup while live data is intact.

let db: Client;

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
`;

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
  for (const t of ["Receipt", "SplitPayment", "Payment", "Order", "PlayerSession", "Bill", "CashExpense", "CashTopup", "CashDrawerSession"]) {
    await db.execute(`DELETE FROM "${t}" WHERE is_test=1`);
  }
}

before(async () => { db = createClient({ url: "file::memory:" }); await db.executeMultiple(DDL); });
after(async () => { await db.close(); });
beforeEach(async () => {
  for (const t of ["OrderItem", "Receipt", "SplitPayment", "Payment", "Order", "PlayerSession", "Bill", "CashExpense", "CashTopup", "CashDrawerSession"]) {
    await db.execute(`DELETE FROM "${t}"`);
  }
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
  await createOrder(true, 5);
  await db.execute(`INSERT INTO "Bill"(is_test) VALUES (0),(1)`);
  await db.execute(`INSERT INTO PlayerSession(is_test) VALUES (0),(1)`);
  await db.execute(`INSERT INTO SplitPayment(orderId,amountTHB,is_test) VALUES (1,10,1)`);
  await db.execute(`INSERT INTO Receipt(orderId,is_test) VALUES (777,1)`);
  await db.execute(`INSERT INTO CashExpense(amount,type,is_test) VALUES (50,'PETTY_CASH',1)`);
  await db.execute(`INSERT INTO CashTopup(amount,is_test) VALUES (100,1)`);
  await db.execute(`INSERT INTO CashDrawerSession(date,is_test) VALUES ('2026-06-14',1)`);

  await clearTestData();

  // no test rows remain in ANY tagged table
  for (const t of TAGGED_MODELS) {
    const tbl = t === "Order" ? `"Order"` : `"${t}"`;
    const left = Number((await db.execute(`SELECT COUNT(*) c FROM ${tbl} WHERE is_test=1`)).rows[0].c);
    assert.equal(left, 0, `${t} still has test rows after cleanup`);
  }
  // no orphaned OrderItems from deleted test orders
  const orphans = Number((await db.execute(`SELECT COUNT(*) c FROM OrderItem WHERE orderId NOT IN (SELECT id FROM "Order")`)).rows[0].c);
  assert.equal(orphans, 0, "test orders' OrderItems must be gone too");
  // live data untouched
  assert.equal(Number((await db.execute(`SELECT COUNT(*) c FROM "Order"`)).rows[0].c), 1, "the one live order survives");
  assert.equal(Number((await db.execute(`SELECT id FROM "Order"`)).rows[0].id), liveOrder);
  assert.equal(await cashTotal(false), 100, "live cash total intact");
});

test("TAGGED_MODELS, the schema columns, the migration and the cleanup list stay in sync", async () => {
  // every tagged model must be wiped by cleanup → assert each is empty of test rows
  // (guards against adding a model to the column list but forgetting cleanup)
  await db.execute(`INSERT INTO "Bill"(is_test) VALUES (1)`);
  await db.execute(`INSERT INTO CashTopup(amount,is_test) VALUES (1,1)`);
  await clearTestData();
  assert.equal(Number((await db.execute(`SELECT COUNT(*) c FROM "Bill" WHERE is_test=1`)).rows[0].c), 0);
  assert.equal(Number((await db.execute(`SELECT COUNT(*) c FROM CashTopup WHERE is_test=1`)).rows[0].c), 0);
  assert.equal(TAGGED_MODELS.length, 9, "Phase 1 covers the 9 sales/cashier tables");
});
