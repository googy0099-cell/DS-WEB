import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

/**
 * Revenue reconciliation checker (read-only).
 *
 *   npx ts-node --esm scripts/verify-revenue.ts [YYYY-MM-DD]
 *
 * Verifies the invariants behind the revenue/points refactor:
 *  A. No CONFIRMED payment is still method "TAB" (tab-checkout must rewrite it).
 *  B. Payments on CANCELLED orders are excluded from revenue (reported as info).
 *  C. Per settled bill:  Σ confirmed payments == Σ non-cancelled order totals − discount.
 *  D. Food vs game-time split (by order-item category) — printed for eyeballing.
 *  E. No member has negative points / dicePoints / totalSpentTHB (refund clamp).
 *
 * Exits non-zero if any hard check (A, C, E) fails — usable as a pre-deploy gate.
 */

const db = new PrismaClient({
  adapter: new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
});

const b = (n: number) => `฿${n.toLocaleString()}`;

function dayRange(arg?: string) {
  const bkkToday = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const day = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : bkkToday;
  const [y, m, d] = day.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, -7, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, -7, 0, 0));
  return { day, start, end };
}

async function main() {
  const { day, start, end } = dayRange(process.argv[2]);
  const fails: string[] = [];
  console.log(`\n🔎 ตรวจรายได้วันที่ ${day} (BKK)\n${"─".repeat(48)}`);

  // Confirmed payments settled in range
  const payments = await db.payment.findMany({
    where: { status: "CONFIRMED", confirmedAt: { gte: start, lt: end } },
    select: { id: true, method: true, amountTHB: true, order: { select: { status: true, billId: true } } },
  });
  const valid = payments.filter((p) => p.order && p.order.status !== "CANCELLED");
  const revenue = valid.reduce((s, p) => s + p.amountTHB, 0);
  const cash = valid.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amountTHB, 0);
  const transfer = revenue - cash;
  console.log(`รายได้สุทธิ (Σ confirmed payment): ${b(revenue)}  [เงินสด ${b(cash)} · โอน/QR ${b(transfer)}]`);
  console.log(`จำนวนการชำระ: ${valid.length} รายการ`);

  // Food vs game-time split (by item category)
  const items = await db.orderItem.findMany({
    where: {
      cancelledAt: null,
      order: { status: { not: "CANCELLED" }, payment: { status: "CONFIRMED", confirmedAt: { gte: start, lt: end } } },
    },
    select: { quantity: true, unitPriceTHB: true, menuItem: { select: { category: true } } },
  });
  let gtGross = 0, totGross = 0;
  for (const it of items) {
    const a = it.quantity * it.unitPriceTHB;
    totGross += a;
    if (it.menuItem.category === "gametime") gtGross += a;
  }
  const game = totGross > 0 ? Math.round((revenue * gtGross) / totGross) : 0;
  console.log(`แยกหมวด: 🍽️ อาหาร ${b(revenue - game)} · 🎲 ค่าเล่นเกม ${b(game)}\n`);

  // A. TAB leftovers
  const tabLeft = payments.filter((p) => p.method === "TAB");
  if (tabLeft.length) {
    fails.push(`A: พบ Payment CONFIRMED ที่ method ยังเป็น 'TAB' ${tabLeft.length} แถว (id: ${tabLeft.map((p) => p.id).join(", ")})`);
  } else console.log("✅ A. ไม่มี payment ค้าง method=TAB");

  // B. cancelled-order payments (info)
  const cancelled = payments.filter((p) => p.order?.status === "CANCELLED");
  if (cancelled.length) {
    console.log(`ℹ️  B. payment บนออเดอร์ที่ยกเลิก ${cancelled.length} แถว = ${b(cancelled.reduce((s, p) => s + p.amountTHB, 0))} (ถูกตัดออกจากรายได้แล้ว — ควรมีการคืนเงินจริงตามนี้)`);
  } else console.log("✅ B. ไม่มี payment บนออเดอร์ที่ยกเลิก");

  // C. per-bill integrity (bills settled in range)
  const billIds = [...new Set(valid.map((p) => p.order?.billId).filter((x): x is number => x != null))];
  const bills = await db.bill.findMany({
    where: { id: { in: billIds } },
    select: {
      id: true, name: true, discountAmount: true,
      orders: { where: { status: { not: "CANCELLED" } }, select: { totalTHB: true, payment: { select: { amountTHB: true, status: true } } } },
    },
  });
  let badBills = 0;
  for (const bill of bills) {
    const gross = bill.orders.reduce((s, o) => s + o.totalTHB, 0);
    const paid = bill.orders.reduce((s, o) => s + (o.payment?.status === "CONFIRMED" ? o.payment.amountTHB : 0), 0);
    const expected = gross - (bill.discountAmount ?? 0);
    if (paid !== expected) {
      badBills++;
      fails.push(`C: บิล #${bill.id} (${bill.name}) จ่ายจริง ${b(paid)} ≠ ${b(expected)} (gross ${b(gross)} − ส่วนลด ${b(bill.discountAmount ?? 0)})`);
    }
  }
  if (!badBills) console.log(`✅ C. ทุกบิลที่ปิดวันนี้ (${bills.length}) Σ payment = gross − ส่วนลด`);

  // E. negative balances (global)
  const neg = await db.user.count({ where: { OR: [{ points: { lt: 0 } }, { dicePoints: { lt: 0 } }, { totalSpentTHB: { lt: 0 } }] } });
  if (neg) fails.push(`E: มีสมาชิก ${neg} คนที่ points/dicePoints/totalSpentTHB ติดลบ`);
  else console.log("✅ E. ไม่มีสมาชิกที่แต้ม/ยอดสะสมติดลบ");

  console.log("─".repeat(48));
  if (fails.length) {
    console.log(`❌ พบปัญหา ${fails.length} จุด:`);
    for (const f of fails) console.log(`   • ${f}`);
    process.exitCode = 1;
  } else {
    console.log("✅ ผ่านทุกข้อ — ตัวเลขสอดคล้องกัน");
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
