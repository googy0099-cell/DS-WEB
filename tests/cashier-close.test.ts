import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createClient, type Client } from "@libsql/client";
import { shopGeofence } from "../src/lib/hr-checkin-token.ts";

// Real libSQL engine, in-memory — proves EOD close reconciliation (opening float
// + cross-midnight shift date + split cash + cancelled exclusion) at the SQL
// level, mirroring /api/cashier/close, without touching production.

let db: Client;

const DDL = `
CREATE TABLE "Order" (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT NOT NULL DEFAULT 'CONFIRMED', totalTHB INTEGER NOT NULL);
CREATE TABLE Payment (id INTEGER PRIMARY KEY AUTOINCREMENT, orderId INTEGER UNIQUE, method TEXT, amountTHB INTEGER, status TEXT, confirmedAt TEXT);
CREATE TABLE SplitPayment (id INTEGER PRIMARY KEY AUTOINCREMENT, orderId INTEGER, amountTHB INTEGER, confirmedAt TEXT);
CREATE TABLE CashExpense (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, amount INTEGER, createdAt TEXT);
CREATE TABLE CashTopup (id INTEGER PRIMARY KEY AUTOINCREMENT, amount INTEGER, createdAt TEXT);
CREATE TABLE shop_session (id INTEGER PRIMARY KEY, opening_float INTEGER);
`;

// mirror of getDayBoundsForDate() in the close/summary routes
function dayBounds(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 7 * 3600_000);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400_000).toISOString() };
}

// mirror of POST /api/cashier/close (the reconciliation maths)
async function closeDay(date: string, openingFloat: number, countedCash: number) {
  const { start, end } = dayBounds(date);
  const pays = (await db.execute({
    sql: `SELECT p.method, p.amountTHB, o.status ost FROM Payment p JOIN "Order" o ON o.id=p.orderId
          WHERE p.status='CONFIRMED' AND p.confirmedAt>=? AND p.confirmedAt<?`,
    args: [start, end],
  })).rows.filter((r) => r.ost !== "CANCELLED");
  const splits = (await db.execute({
    sql: `SELECT s.amountTHB, o.status ost FROM SplitPayment s JOIN "Order" o ON o.id=s.orderId
          WHERE s.confirmedAt>=? AND s.confirmedAt<?`,
    args: [start, end],
  })).rows.filter((r) => r.ost !== "CANCELLED");
  const petty = Number((await db.execute({ sql: `SELECT COALESCE(SUM(amount),0) t FROM CashExpense WHERE type='PETTY_CASH' AND createdAt>=? AND createdAt<?`, args: [start, end] })).rows[0].t);
  const topup = Number((await db.execute({ sql: `SELECT COALESCE(SUM(amount),0) t FROM CashTopup WHERE createdAt>=? AND createdAt<?`, args: [start, end] })).rows[0].t);

  const splitCash = splits.reduce((a, x) => a + Number(x.amountTHB), 0);
  const cashSales = pays.filter((p) => p.method === "CASH").reduce((a, p) => a + Number(p.amountTHB), 0) + splitCash;
  const transfer = pays.filter((p) => p.method !== "CASH").reduce((a, p) => a + Number(p.amountTHB), 0);
  const expectedCash = cashSales - petty + topup;
  const difference = countedCash - (openingFloat + expectedCash);
  return { cashSales, transfer, expectedCash, difference, grand: cashSales + transfer };
}

const pay = (id: number, method: string, amt: number, at: string, status = "CONFIRMED") =>
  db.execute({ sql: `INSERT INTO "Order"(id,status,totalTHB) VALUES (?,?,?)`, args: [id, "CONFIRMED", amt] })
    .then(() => db.execute({ sql: `INSERT INTO Payment(orderId,method,amountTHB,status,confirmedAt) VALUES (?,?,?,?,?)`, args: [id, method, amt, status, at] }));

before(async () => { db = createClient({ url: "file::memory:" }); await db.executeMultiple(DDL); });
after(async () => { await db.close(); });
beforeEach(async () => { await db.executeMultiple(`DELETE FROM Payment; DELETE FROM "Order"; DELETE FROM SplitPayment; DELETE FROM CashExpense; DELETE FROM CashTopup; DELETE FROM shop_session;`); });

test("same-day close: expected = float + cash − petty + topup; difference vs counted", async () => {
  await pay(1, "CASH", 1000, "2026-06-13T05:00:00.000Z");   // BKK 12:00
  await pay(2, "PROMPTPAY", 500, "2026-06-13T06:00:00.000Z");
  await db.execute(`INSERT INTO CashExpense(type,amount,createdAt) VALUES ('PETTY_CASH',200,'2026-06-13T07:00:00.000Z')`);
  await db.execute(`INSERT INTO CashTopup(amount,createdAt) VALUES (300,'2026-06-13T07:30:00.000Z')`);

  const r = await closeDay("2026-06-13", 1000, 2100);
  assert.equal(r.expectedCash, 1100, "1000 cash − 200 petty + 300 topup");
  assert.equal(r.transfer, 500);
  assert.equal(r.difference, 0, "counted 2100 == float 1000 + expected 1100");
  assert.equal(r.grand, 1500);
});

test("REGRESSION: a shift opened late and closed after midnight reconciles against ITS day, not the calendar 'today'", async () => {
  // sale at BKK 2026-06-13 22:00 == UTC 15:00 ; staff closes at BKK 2026-06-14 02:00
  await pay(1, "CASH", 1161, "2026-06-13T15:00:00.000Z");
  await pay(2, "PROMPTPAY", 868, "2026-06-13T15:30:00.000Z");
  await db.execute(`INSERT INTO CashExpense(type,amount,createdAt) VALUES ('PETTY_CASH',200,'2026-06-13T15:10:00.000Z')`);

  const correct = await closeDay("2026-06-13", 1412, 2525); // close with the SHIFT date
  assert.equal(correct.cashSales, 1161);
  assert.equal(correct.expectedCash, 961, "1161 − 200");
  assert.equal(correct.difference, 152, "the real +152, not a phantom excess");

  const wrong = await closeDay("2026-06-14", 1412, 2525);   // the OLD bug: closing against 'today'
  assert.equal(wrong.cashSales, 0, "yesterday's sales fall outside today's bounds");
  assert.equal(wrong.difference, 1113, "this is the bogus +1113 the fix prevents");
});

test("opening float comes from shop_session (survives midnight / device switch)", async () => {
  await db.execute(`INSERT INTO shop_session(id,opening_float) VALUES (1,1412)`);
  await pay(1, "CASH", 100, "2026-06-13T05:00:00.000Z");
  const float = Number((await db.execute(`SELECT opening_float FROM shop_session WHERE id=1`)).rows[0].opening_float);
  assert.equal(float, 1412, "persisted opening float is read back, not reset to 0");
  const r = await closeDay("2026-06-13", float, 1512);
  assert.equal(r.difference, 0, "1512 == 1412 float + 100 cash");
});

test("split cash counts toward the drawer; cancelled orders are excluded", async () => {
  // order 1: split — transfer 80 on Payment + cash 120 as SplitPayment
  await db.execute(`INSERT INTO "Order"(id,status,totalTHB) VALUES (1,'CONFIRMED',200)`);
  await db.execute(`INSERT INTO Payment(orderId,method,amountTHB,status,confirmedAt) VALUES (1,'PROMPTPAY',80,'CONFIRMED','2026-06-13T05:00:00.000Z')`);
  await db.execute(`INSERT INTO SplitPayment(orderId,amountTHB,confirmedAt) VALUES (1,120,'2026-06-13T05:00:00.000Z')`);
  // order 2: cancelled cash sale — must not count
  await pay(2, "CASH", 999, "2026-06-13T05:30:00.000Z");
  await db.execute(`UPDATE "Order" SET status='CANCELLED' WHERE id=2`);

  const r = await closeDay("2026-06-13", 0, 120);
  assert.equal(r.cashSales, 120, "split cash counted, cancelled 999 excluded");
  assert.equal(r.transfer, 80);
  assert.equal(r.difference, 0);
});

test("shopGeofence(): disabled when SHOP_LAT is unset, configured (default radius 150) when set", () => {
  const lat = process.env.SHOP_LAT, lng = process.env.SHOP_LNG, rad = process.env.SHOP_RADIUS_M;
  try {
    delete process.env.SHOP_LAT; delete process.env.SHOP_LNG;
    assert.equal(shopGeofence(), null, "no coords → GPS gating disabled");

    process.env.SHOP_LAT = "13.7563"; process.env.SHOP_LNG = "100.5018"; delete process.env.SHOP_RADIUS_M;
    assert.deepEqual(shopGeofence(), { lat: 13.7563, lng: 100.5018, radiusM: 150 }, "defaults to 150m");

    process.env.SHOP_RADIUS_M = "80";
    assert.equal(shopGeofence()?.radiusM, 80, "explicit radius is honoured");
  } finally {
    if (lat === undefined) delete process.env.SHOP_LAT; else process.env.SHOP_LAT = lat;
    if (lng === undefined) delete process.env.SHOP_LNG; else process.env.SHOP_LNG = lng;
    if (rad === undefined) delete process.env.SHOP_RADIUS_M; else process.env.SHOP_RADIUS_M = rad;
  }
});
