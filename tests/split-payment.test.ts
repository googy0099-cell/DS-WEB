import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createClient, type Client } from "@libsql/client";

// Real libSQL engine, in-memory — proves split-payment recording + drawer
// reconciliation at the SQL level, mirroring the route handlers, without ever
// touching the production Turso database.

let db: Client;

const DDL = `
CREATE TABLE "Order" (id INTEGER PRIMARY KEY AUTOINCREMENT, billId INTEGER, status TEXT NOT NULL DEFAULT 'CONFIRMED', totalTHB INTEGER NOT NULL);
CREATE TABLE Payment (id INTEGER PRIMARY KEY AUTOINCREMENT, orderId INTEGER UNIQUE, method TEXT, amountTHB INTEGER, status TEXT, splitCashTHB INTEGER, confirmedAt TEXT);
CREATE TABLE SplitPayment (id INTEGER PRIMARY KEY AUTOINCREMENT, orderId INTEGER, billId INTEGER, amountTHB INTEGER, confirmedAt TEXT);
`;

const NOW = "2026-06-13T12:00:00.000Z";

// ── mirrors of the route logic under test ────────────────────────────────────

// /api/pos/bills/[id]/tab-checkout (split branch): allocate transfer across the
// bill's orders, record the cash portion as one SplitPayment row.
async function tabCheckoutSplit(billId: number, finalTotal: number, splitCashTHB: number) {
  const orders = (await db.execute({ sql: `SELECT id, totalTHB FROM "Order" WHERE billId=? ORDER BY id`, args: [billId] })).rows;
  const tabTotal = orders.reduce((s, o) => s + Number(o.totalTHB), 0);
  const cashPortion = Math.max(0, Math.min(Math.round(splitCashTHB), finalTotal));
  const transferPortion = finalTotal - cashPortion;
  const isSplit = cashPortion > 0 && transferPortion > 0;
  const method = isSplit ? "PROMPTPAY" : cashPortion >= finalTotal && cashPortion > 0 ? "CASH" : "PROMPTPAY";
  const allocTotal = isSplit ? transferPortion : finalTotal;
  let allocated = 0;
  for (let i = 0; i < orders.length; i++) {
    const share = i === orders.length - 1 ? allocTotal - allocated : (tabTotal > 0 ? Math.round((Number(orders[i].totalTHB) / tabTotal) * allocTotal) : 0);
    allocated += i === orders.length - 1 ? 0 : share;
    await db.execute({ sql: `UPDATE Payment SET status='CONFIRMED', confirmedAt=?, method=?, amountTHB=? WHERE orderId=?`, args: [NOW, method, share, orders[i].id] });
  }
  if (isSplit) {
    await db.execute({ sql: `INSERT INTO SplitPayment (orderId, billId, amountTHB, confirmedAt) VALUES (?,?,?,?)`, args: [orders[0].id, billId, cashPortion, NOW] });
  }
}

// /api/payment/qr (split): hold cash on the Payment, no SplitPayment yet.
async function qrScan(orderId: number, finalAmount: number, splitCashTHB: number) {
  const cashPortion = Math.max(0, Math.min(Math.round(splitCashTHB), finalAmount));
  const transferPortion = finalAmount - cashPortion;
  await db.execute({ sql: `UPDATE Payment SET method='PROMPTPAY', amountTHB=?, splitCashTHB=? WHERE orderId=?`, args: [transferPortion, cashPortion > 0 ? cashPortion : null, orderId] });
}

// /api/payment/confirm: confirm payment; materialise the held cash as a SplitPayment.
async function confirmPayment(orderId: number) {
  const pay = (await db.execute({ sql: `SELECT splitCashTHB FROM Payment WHERE orderId=?`, args: [orderId] })).rows[0] as { splitCashTHB: number | null };
  await db.execute({ sql: `UPDATE Payment SET status='CONFIRMED', confirmedAt=? WHERE orderId=?`, args: [NOW, orderId] });
  if (pay && pay.splitCashTHB && Number(pay.splitCashTHB) > 0) {
    const ord = (await db.execute({ sql: `SELECT billId FROM "Order" WHERE id=?`, args: [orderId] })).rows[0] as { billId: number | null };
    await db.execute({ sql: `DELETE FROM SplitPayment WHERE orderId=?`, args: [orderId] });
    await db.execute({ sql: `INSERT INTO SplitPayment (orderId, billId, amountTHB, confirmedAt) VALUES (?,?,?,?)`, args: [orderId, ord?.billId ?? null, Number(pay.splitCashTHB), NOW] });
  }
}

// /api/cashier/close + revenue.computeRevenue: cash/transfer totals (exclude cancelled).
async function totals() {
  const pays = (await db.execute(`SELECT p.method, p.amountTHB, o.status ost FROM Payment p JOIN "Order" o ON o.id=p.orderId WHERE p.status='CONFIRMED'`)).rows.filter((r) => r.ost !== "CANCELLED");
  const sp = (await db.execute(`SELECT s.amountTHB, o.status ost FROM SplitPayment s JOIN "Order" o ON o.id=s.orderId`)).rows.filter((r) => r.ost !== "CANCELLED");
  const splitCash = sp.reduce((a, x) => a + Number(x.amountTHB), 0);
  const cash = pays.filter((p) => p.method === "CASH").reduce((a, p) => a + Number(p.amountTHB), 0) + splitCash;
  const transfer = pays.filter((p) => p.method !== "CASH").reduce((a, p) => a + Number(p.amountTHB), 0);
  return { cash, transfer, grand: cash + transfer };
}

before(async () => { db = createClient({ url: "file::memory:" }); await db.executeMultiple(DDL); });
after(async () => { await db.close(); });
beforeEach(async () => { await db.executeMultiple(`DELETE FROM SplitPayment; DELETE FROM Payment; DELETE FROM "Order";`); });

test("bill split (cash + transfer): cash leg recorded, transfer split across orders, drawer reconciles", async () => {
  await db.execute(`INSERT INTO "Order" (id,billId,status,totalTHB) VALUES (1,9,'CONFIRMED',120),(2,9,'CONFIRMED',80)`);
  await db.execute(`INSERT INTO Payment (orderId,method,amountTHB,status) VALUES (1,'TAB',120,'PENDING'),(2,'TAB',80,'PENDING')`);
  await tabCheckoutSplit(9, 200, 120); // pay ฿120 cash + ฿80 transfer

  const t = await totals();
  assert.equal(t.cash, 120, "cash leg must be recorded as cash");
  assert.equal(t.transfer, 80, "remainder is transfer");
  assert.equal(t.grand, 200, "no money lost or double-counted");

  const transferOnPayments = (await db.execute(`SELECT SUM(amountTHB) s FROM Payment WHERE method='PROMPTPAY'`)).rows[0].s;
  assert.equal(Number(transferOnPayments), 80, "Σ order payments == transfer portion exactly (allocation remainder lands on last order)");
});

test("full-cash via split UI records CASH and no SplitPayment row", async () => {
  await db.execute(`INSERT INTO "Order" (id,billId,status,totalTHB) VALUES (1,9,'CONFIRMED',150)`);
  await db.execute(`INSERT INTO Payment (orderId,method,amountTHB,status) VALUES (1,'TAB',150,'PENDING')`);
  await tabCheckoutSplit(9, 150, 150);
  const t = await totals();
  assert.equal(t.cash, 150);
  assert.equal(t.transfer, 0);
  const splitRows = (await db.execute(`SELECT COUNT(*) c FROM SplitPayment`)).rows[0].c;
  assert.equal(Number(splitRows), 0, "all-cash is a plain CASH payment, not a split");
});

test("single-order split: cash counts only after the payment is confirmed", async () => {
  await db.execute(`INSERT INTO "Order" (id,billId,status,totalTHB) VALUES (1,5,'CONFIRMED',200)`);
  await db.execute(`INSERT INTO Payment (orderId,method,amountTHB,status) VALUES (1,'PROMPTPAY',200,'PENDING')`);
  await qrScan(1, 200, 120);

  let t = await totals();
  assert.equal(t.cash, 0, "scanning (unconfirmed) must not count cash yet");
  assert.equal((await db.execute(`SELECT COUNT(*) c FROM SplitPayment`)).rows[0].c, 0);

  await confirmPayment(1);
  t = await totals();
  assert.equal(t.cash, 120, "cash recorded on confirm");
  assert.equal(t.transfer, 80);
  assert.equal(t.grand, 200);
});

test("abandoned split scan (never confirmed) does not count as revenue", async () => {
  await db.execute(`INSERT INTO "Order" (id,billId,status,totalTHB) VALUES (1,5,'CONFIRMED',100)`);
  await db.execute(`INSERT INTO Payment (orderId,method,amountTHB,status) VALUES (1,'PROMPTPAY',100,'PENDING')`);
  await qrScan(1, 100, 60); // customer paid cash then walked off before scanning
  const t = await totals();
  assert.equal(t.cash, 0, "held cash on an unconfirmed payment is never revenue");
  assert.equal(t.grand, 0);
});

test("cancelled order is excluded from cash/transfer totals (split leg too)", async () => {
  await db.execute(`INSERT INTO "Order" (id,billId,status,totalTHB) VALUES (1,5,'CONFIRMED',200)`);
  await db.execute(`INSERT INTO Payment (orderId,method,amountTHB,status) VALUES (1,'PROMPTPAY',200,'PENDING')`);
  await qrScan(1, 200, 120);
  await confirmPayment(1);
  await db.execute(`UPDATE "Order" SET status='CANCELLED' WHERE id=1`);
  const t = await totals();
  assert.equal(t.cash, 0, "cancelled order's cash split must drop out");
  assert.equal(t.transfer, 0, "cancelled order's transfer must drop out");
});

test("split discount on a bill: cash + transfer still sum to the discounted total", async () => {
  await db.execute(`INSERT INTO "Order" (id,billId,status,totalTHB) VALUES (1,9,'CONFIRMED',100),(2,9,'CONFIRMED',100)`);
  await db.execute(`INSERT INTO Payment (orderId,method,amountTHB,status) VALUES (1,'TAB',100,'PENDING'),(2,'TAB',100,'PENDING')`);
  await tabCheckoutSplit(9, 180, 100); // ฿20 discount → finalTotal 180, pay 100 cash + 80 transfer
  const t = await totals();
  assert.equal(t.cash, 100);
  assert.equal(t.transfer, 80);
  assert.equal(t.grand, 180, "totals reconcile to the discounted amount");
});
