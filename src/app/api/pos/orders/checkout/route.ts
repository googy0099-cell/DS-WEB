import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { deductStockForOrder } from "@/lib/stock-deduct";
import { notifyOrderPaid } from "@/lib/telegram-notify";

// Combined checkout for a manually-selected set of orders (not tied to a bill/party).
// Mirrors /api/pos/bills/[id]/tab-checkout but keyed by orderIds[] instead of billId.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderIds, memberUserId, paymentMethod, discountType, discountValue, splitCashTHB } =
    (await req.json()) as {
      orderIds?: number[];
      memberUserId?: number | null;
      paymentMethod?: string;
      discountType?: "PERCENT" | "FIXED";
      discountValue?: number;
      discountNote?: string;
      splitCashTHB?: number; // แบ่งจ่าย: ส่วนเงินสด (ที่เหลือเป็นโอน)
    };

  const ids = (orderIds ?? []).filter((n) => Number.isInteger(n));
  if (ids.length === 0) {
    return NextResponse.json({ error: "ไม่ได้เลือกออเดอร์" }, { status: 400 });
  }

  // Only settle orders that are still unpaid
  const orders = await db.order.findMany({
    where: {
      id: { in: ids },
      status: { in: ["PENDING", "CONFIRMED", "SERVED"] },
      payment: { status: "PENDING" },
    },
    select: {
      id: true, status: true, totalTHB: true, orderName: true, kitchenServedAt: true, userId: true,
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
    orderBy: { createdAt: "asc" },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "ไม่มีออเดอร์ที่ยังไม่ได้ชำระ" }, { status: 400 });
  }

  const tabTotal = orders.reduce((sum, o) => sum + o.totalTHB, 0);

  // Discount calculation
  let discountAmount = 0;
  if (discountType && discountValue && discountValue > 0) {
    if (discountType === "PERCENT") {
      discountAmount = Math.round((tabTotal * Math.min(discountValue, 100)) / 100);
    } else {
      discountAmount = Math.min(discountValue, tabTotal);
    }
  }
  const finalTotal = tabTotal - discountAmount;

  const now = new Date();

  // แบ่งจ่าย (split): cash portion → SplitPayment, the rest → transfer recorded on Payments.
  const cashPortion = Math.max(0, Math.min(Math.round(splitCashTHB ?? 0), finalTotal));
  const transferPortion = finalTotal - cashPortion;
  const isSplit = cashPortion > 0 && transferPortion > 0;
  const actualPaymentMethod = isSplit
    ? "PROMPTPAY"
    : cashPortion >= finalTotal && cashPortion > 0
      ? "CASH"
      : paymentMethod === "CASH"
        ? "CASH"
        : "PROMPTPAY";

  // Allocate the recorded portion across orders proportionally; remainder on last order.
  const allocTotal = isSplit ? transferPortion : finalTotal;
  let allocated = 0;
  const netByOrder = orders.map((o, idx) => {
    if (idx === orders.length - 1) return allocTotal - allocated;
    const share = tabTotal > 0 ? Math.round((o.totalTHB / tabTotal) * allocTotal) : 0;
    allocated += share;
    return share;
  });

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
      .filter((o) => o.status !== "SERVED")
      .map((o) =>
        db.order.update({
          where: { id: o.id },
          data: { status: o.kitchenServedAt ? "SERVED" : "PAID" },
        })
      ),
    ...(isSplit
      ? [db.splitPayment.create({ data: { orderId: orders[0].id, amountTHB: cashPortion, confirmedAt: now } })]
      : []),
  ]);

  const effectiveMemberId = memberUserId ?? orders.find((o) => o.userId != null)?.userId ?? null;

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

  // Deduct stock only for orders that became SERVED now.
  const staffId = Number(session.user.id);
  const newlyServed = orders.filter((o) => o.kitchenServedAt && o.status !== "SERVED");
  await Promise.allSettled(newlyServed.map((o) => deductStockForOrder(o.id, staffId)));

  // One combined digital receipt for the whole selection (saved on the first order).
  const firstOrder = orders[0];
  const receiptLabel = orders.length > 1 ? `รวม ${orders.length} ออเดอร์` : firstOrder.orderName;
  const locationLabel = firstOrder.bill ? `${firstOrder.bill.name} · โต๊ะ ${firstOrder.bill.table.number}` : "-";
  const allItems = orders.flatMap((o) => o.items);
  await db.receipt.upsert({
    where: { orderId: firstOrder.id },
    create: {
      orderId: firstOrder.id,
      orderName: receiptLabel,
      totalTHB: finalTotal,
      discountAmount: discountAmount > 0 ? discountAmount : null,
      paymentMethod: isSplit ? "SPLIT" : actualPaymentMethod,
      locationLabel,
      itemsJson: JSON.stringify(allItems),
      confirmedAt: now,
    },
    update: {},
  });

  {
    const itemLines = allItems
      .map((i) => `  • ${i.menuItem.nameTh} x${i.quantity} = ฿${(i.unitPriceTHB * i.quantity).toLocaleString("th-TH")}`)
      .join("\n");
    notifyOrderPaid({
      orderLabel: receiptLabel,
      location: firstOrder.bill ? `โต๊ะ ${firstOrder.bill.table.number}` : "",
      itemLines,
      netTotal: finalTotal,
      method: actualPaymentMethod,
    }).catch(() => {});
  }

  return NextResponse.json({ tabTotal, discountAmount, finalTotal, ordersCount: orders.length, pointsAwarded });
}
