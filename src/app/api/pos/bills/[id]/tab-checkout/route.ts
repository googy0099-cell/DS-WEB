import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { deductStockForOrder } from "@/lib/stock-deduct";

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

  const { memberUserId, paymentMethod } = await req.json() as { memberUserId?: number | null; paymentMethod?: string };

  const orders = await db.order.findMany({
    where: {
      billId: Number(id),
      status: { in: ["PENDING", "CONFIRMED", "SERVED"] },
      payment: { method: "TAB", status: "PENDING" },
    },
    include: {
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
  const now = new Date();

  // Mark SERVED only if kitchen has finished; already-SERVED orders stay SERVED; else PAID
  await db.$transaction([
    ...orders.map((o) =>
      db.payment.update({
        where: { id: o.payment!.id },
        data: { status: "CONFIRMED", confirmedAt: now },
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

  let pointsAwarded = 0;
  if (memberUserId) {
    const pts = Math.floor(tabTotal / 10);
    const dice = Math.floor(tabTotal / 49);
    await db.user.update({
      where: { id: Number(memberUserId) },
      data: {
        points: { increment: pts },
        totalSpentTHB: { increment: tabTotal },
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
  const actualPaymentMethod = paymentMethod === "CASH" ? "CASH" : "PROMPTPAY";
  await db.receipt.upsert({
    where: { orderId: firstOrder.id },
    create: {
      orderId: firstOrder.id,
      orderName: `ตี้ ${billName}`,
      totalTHB,
      paymentMethod: actualPaymentMethod,
      locationLabel,
      itemsJson: JSON.stringify(allItems),
      confirmedAt: now,
    },
    update: {},
  });

  return NextResponse.json({ tabTotal, ordersCount: orders.length, pointsAwarded });
}
