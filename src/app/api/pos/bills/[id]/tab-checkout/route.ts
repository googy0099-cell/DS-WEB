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

  const { memberUserId, paymentMethod, discountType, discountValue, discountNote } = await req.json() as {
    memberUserId?: number | null;
    paymentMethod?: string;
    discountType?: "PERCENT" | "FIXED";
    discountValue?: number;
    discountNote?: string;
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
  const actualPaymentMethod = paymentMethod === "CASH" ? "CASH" : "PROMPTPAY";

  // Allocate the discount across orders proportionally so that the sum of each
  // payment's net amount equals finalTotal exactly (remainder lands on the last
  // order). This makes Payment.amountTHB the actual money received — so revenue
  // reporting (Σ confirmed payments) and the cash drawer reconcile.
  let allocated = 0;
  const netByOrder = orders.map((o, idx) => {
    if (idx === orders.length - 1) return finalTotal - allocated;
    const share = tabTotal > 0 ? Math.round((o.totalTHB / tabTotal) * finalTotal) : 0;
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
