import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { deductStockForOrder } from "@/lib/stock-deduct";
import { notifyOrderPaid } from "@/lib/telegram-notify";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orders = await db.order.findMany({
    where: {
      billId: Number(id),
      status: { in: ["PENDING", "CONFIRMED", "SERVED"] },
      payment: { method: "TAB", status: "PENDING" },
    },
    include: {
      items: {
        include: { menuItem: { select: { nameTh: true } } },
      },
      payment: { select: { id: true, amountTHB: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const tabTotal = orders.reduce((sum, o) => sum + o.totalTHB, 0);
  return NextResponse.json({ orders, tabTotal });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { memberUserId, paymentMethod, discountType, discountValue, discountNote, splitCashTHB } = await req.json() as {
    memberUserId?: number | null;
    paymentMethod?: string;
    discountType?: "PERCENT" | "FIXED";
    discountValue?: number;
    discountNote?: string;
    splitCashTHB?: number; // แบ่งจ่าย: ส่วนเงินสด (ที่เหลือเป็นโอน)
  };

  const orders = await db.order.findMany({
    where: {
      billId: Number(id),
      status: { in: ["PENDING", "CONFIRMED", "SERVED"] },
      payment: { method: "TAB", status: "PENDING" },
    },
    select: {
      id: true, status: true, totalTHB: true, kitchenServedAt: true, userId: true,
      payment: { select: { id: true, amountTHB: true } },
      bill: { select: { name: true, table: { select: { number: true } } } },
      items: {
        where: { cancelledAt: null },
        select: {
          quantity: true, unitPriceTHB: true, selectedSize: true,
          selectedAddons: true, selectedOptions: true,
          menuItem: { select: { nameTh: true } },
        },
      },
    },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "ไม่มีออเดอร์ในแท็บ" }, { status: 400 });
  }

  const tabTotal = orders.reduce((sum, o) => sum + o.totalTHB, 0);

  // Discount calculation
  let discountAmount = 0;
  if (discountType && discountValue && discountValue > 0) {
    if (discountType === "PERCENT") {
      discountAmount = Math.round(tabTotal * Math.min(discountValue, 100) / 100);
    } else {
      discountAmount = Math.min(discountValue, tabTotal);
    }
  }
  const finalTotal = tabTotal - discountAmount;

  const now = new Date();

  // แบ่งจ่าย (split): cash portion goes to a SplitPayment row, the rest is the
  // transfer recorded on the orders' Payments. cashPortion is capped at finalTotal.
  const cashPortion = Math.max(0, Math.min(Math.round(splitCashTHB ?? 0), finalTotal));
  const transferPortion = finalTotal - cashPortion;
  const isSplit = cashPortion > 0 && transferPortion > 0;
  // method on the orders' Payments: split → the transfer leg (PROMPTPAY);
  // cash-only (split UI used for full cash) → CASH; otherwise the chosen method.
  const actualPaymentMethod = isSplit ? "PROMPTPAY"
    : cashPortion >= finalTotal && cashPortion > 0 ? "CASH"
    : paymentMethod === "CASH" ? "CASH" : "PROMPTPAY";

  // Allocate across orders proportionally so the sum of each payment's amount
  // equals the part recorded on Payments (transferPortion when split, else
  // finalTotal). Remainder lands on the last order. Keeps Payment.amountTHB the
  // actual money received per method — so revenue and the cash drawer reconcile.
  const allocTotal = isSplit ? transferPortion : finalTotal;
  let allocated = 0;
  const netByOrder = orders.map((o, idx) => {
    if (idx === orders.length - 1) return allocTotal - allocated;
    const share = tabTotal > 0 ? Math.round((o.totalTHB / tabTotal) * allocTotal) : 0;
    allocated += share;
    return share;
  });

  // Mark SERVED only if kitchen has finished; already-SERVED orders stay SERVED; else PAID
  await db.$transaction([
    ...orders.map((o, idx) =>
      db.payment.update({
        where: { id: o.payment!.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: now,
          method: actualPaymentMethod,
          amountTHB: netByOrder[idx],
        },
      })
    ),
    ...orders
      .filter((o) => o.status !== "SERVED") // don't re-update already-served orders
      .map((o) =>
        db.order.update({
          where: { id: o.id },
          data: { status: o.kitchenServedAt ? "SERVED" : "PAID" },
        })
      ),
    // แบ่งจ่าย: record the cash leg as a SplitPayment (transfer leg lives on the Payments above)
    ...(isSplit
      ? [db.splitPayment.create({
          data: { orderId: orders[0].id, billId: Number(id), amountTHB: cashPortion, confirmedAt: now },
        })]
      : []),
  ]);

  // Fall back to userId from any order in the bill (logged-in customer who ordered via QR)
  const effectiveMemberId = memberUserId ?? orders.find((o) => o.userId != null)?.userId ?? null;

  // Store discount on the bill
  if (discountAmount > 0) {
    await db.bill.update({
      where: { id: Number(id) },
      data: { discountType, discountValue, discountAmount, discountNote: discountNote ?? null },
      select: { id: true },
    });
  }

  let pointsAwarded = 0;
  if (effectiveMemberId) {
    const pts = Math.floor(finalTotal / 10);
    const dice = Math.floor(finalTotal / 49);
    await db.user.update({
      where: { id: Number(effectiveMemberId) },
      data: {
        points: { increment: pts },
        totalSpentTHB: { increment: finalTotal },
        ...(dice > 0 ? { dicePoints: { increment: dice } } : {}),
      },
    });
    pointsAwarded = pts;
  }

  // Deduct stock only for orders that became SERVED NOW (not already-SERVED — stock was deducted when staff hit เสิร์ฟ)
  const staffId = Number(session.user.id);
  const newlyServed = orders.filter((o) => o.kitchenServedAt && o.status !== "SERVED");
  await Promise.allSettled(newlyServed.map((o) => deductStockForOrder(o.id, staffId)));

  // Save ONE combined digital receipt for the whole bill group
  const firstOrder = orders[0];
  const locationLabel = firstOrder.bill
    ? `${firstOrder.bill.name} · โต๊ะ ${firstOrder.bill.table.number}`
    : "-";
  const billName = firstOrder.bill?.name ?? `บิล ${id}`;
  const allItems = orders.flatMap((o) => o.items);
  await db.receipt.upsert({
    where: { orderId: firstOrder.id },
    create: {
      orderId: firstOrder.id,
      orderName: `ตี้ ${billName}`,
      totalTHB: finalTotal,
      discountAmount: discountAmount > 0 ? discountAmount : null,
      paymentMethod: actualPaymentMethod,
      locationLabel,
      itemsJson: JSON.stringify(allItems),
      confirmedAt: now,
    },
    update: {},
  });

  // Notify the ORDER room once for the whole tab — money received now.
  {
    const itemLines = allItems
      .map((i) => `  • ${i.menuItem.nameTh} x${i.quantity} = ฿${(i.unitPriceTHB * i.quantity).toLocaleString("th-TH")}`)
      .join("\n");
    notifyOrderPaid({
      orderLabel: `ตี้ ${billName}`,
      location: firstOrder.bill ? `โต๊ะ ${firstOrder.bill.table.number}` : "",
      itemLines,
      netTotal: finalTotal,
      method: actualPaymentMethod,
    }).catch(() => {});
  }

  return NextResponse.json({ tabTotal, discountAmount, finalTotal, ordersCount: orders.length, pointsAwarded });
}
