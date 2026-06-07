import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { readFileSync, existsSync, unlinkSync } from "fs";
import { resolve } from "path";

/**
 * Build a fresh local libsql test database (file:./test.db) for E2E / integration
 * tests. Applies the schema dumped from prod (scripts/test-schema.sql) then seeds
 * the minimum needed to exercise the discount flow.
 *
 *   npm run test:db:setup
 */
const DB_FILE = resolve(process.cwd(), "test.db");

async function main() {
  for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    if (existsSync(f)) unlinkSync(f);
  }

  const db = createClient({ url: `file:${DB_FILE}` });

  const ddl = readFileSync(resolve(process.cwd(), "scripts/test-schema.sql"), "utf8");
  await db.executeMultiple(ddl);
  console.log("✅ schema applied");

  // Tables 1–5
  for (let n = 1; n <= 5; n++) {
    await db.execute({
      sql: `INSERT INTO "Table" (number, slug, isOccupied) VALUES (?, ?, 0)`,
      args: [n, `tbl${n}slug${n}`],
    });
  }

  // Owner login (matches prisma/seed.ts) + a member for points/dice tests
  const now = new Date().toISOString();
  const ownerHash = await bcrypt.hash("Password1234!", 12);
  await db.execute({
    sql: `INSERT INTO "User" (email, firstName, lastName, username, memberCode, passwordHash, role, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: ["owner@test.local", "Admin", "Owner", "admin", "ADM0", ownerHash, "OWNER", now],
  });
  const memberHash = await bcrypt.hash("Member1234!", 12);
  await db.execute({
    sql: `INSERT INTO "User" (email, firstName, lastName, username, memberCode, passwordHash, role, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: ["member@test.local", "Test", "Member", "member1", "MEM1", memberHash, "USER", now],
  });

  // Menu: a drink (฿65 → matches the real #214 case), food, and the 4 game-time packages
  const menu: [string, string, string, number][] = [
    ["คาราเมลทดสอบ", "test-caramel", "coffee", 65],
    ["ข้าวทดสอบ", "test-rice", "food", 80],
    ["Package A", "gametime-A", "gametime", 0],
    ["Package B", "gametime-B", "gametime", 49],
    ["Package C", "gametime-C", "gametime", 120],
    ["Package D", "gametime-D", "gametime", 80],
  ];
  for (const [nameTh, nameEn, category, priceTHB] of menu) {
    await db.execute({
      sql: `INSERT INTO "MenuItem" (nameTh, nameEn, category, priceTHB, isAvailable) VALUES (?, ?, ?, ?, 1)`,
      args: [nameTh, nameEn, category, priceTHB],
    });
  }

  // A ready discounted+paid order (฿65 − ฿5 = ฿60) so the queue card & receipt
  // can be asserted exactly like the real #214 bug case.
  const caramel = await db.execute(`SELECT id FROM "MenuItem" WHERE nameEn='test-caramel'`);
  const menuId = Number(caramel.rows[0].id);
  const ord = await db.execute({
    sql: `INSERT INTO "Order" (orderName, status, totalTHB, discountAmount, createdAt, updatedAt)
          VALUES (?, 'PAID', 65, 5, ?, ?)`,
    args: ["เทสส่วนลด", now, now],
  });
  const orderId = Number(ord.lastInsertRowid);
  await db.execute({
    sql: `INSERT INTO "OrderItem" (orderId, menuItemId, quantity, unitPriceTHB) VALUES (?, ?, 1, 65)`,
    args: [orderId, menuId],
  });
  await db.execute({
    sql: `INSERT INTO "Payment" (orderId, method, amountTHB, status, confirmedAt) VALUES (?, 'PROMPTPAY', 60, 'CONFIRMED', ?)`,
    args: [orderId, now],
  });
  await db.execute({
    sql: `INSERT INTO "Receipt" (orderId, orderName, totalTHB, discountAmount, paymentMethod, itemsJson, confirmedAt)
          VALUES (?, ?, 60, 5, 'PROMPTPAY', ?, ?)`,
    args: [orderId, "เทสส่วนลด", JSON.stringify([{ menuItem: { nameTh: "คาราเมลทดสอบ" }, quantity: 1, unitPriceTHB: 65 }]), now],
  });
  console.log(`✅ seeded discounted order #${orderId} (฿65 − ฿5 = ฿60)`);

  const counts = await db.execute(
    `SELECT (SELECT COUNT(*) FROM "Table") t, (SELECT COUNT(*) FROM "User") u, (SELECT COUNT(*) FROM "MenuItem") m`
  );
  console.log("✅ seeded:", counts.rows[0]);
  console.log(`✅ test DB ready → file:${DB_FILE}  (login: admin / Password1234!)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
