import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { createSessionsFromStaffNote } from "@/lib/pending-sessions";
import { deductStockForOrder } from "@/lib/stock-deduct";

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "✅ ยืนยันออเดอร์แล้ว",
  SERVED: "🍽️ เสิร์ฟแล้ว",
  CANCELLED: "❌ ยกเลิกออเดอร์",
};

const AUDIT_ACTIONS: Record<string, string> = {
  CONFIRMED: "ORDER_CONFIRMED",
  SERVED: "ORDER_SERVED",
  CANCELLED: "ORDER_CANCELLED",
};

/**
 * Reverse the loyalty/dice points awarded for an order whose paid amount dropped
 * from `oldAmt` to `newAmt` (full refund = newAmt 0). Mirrors the award formula
 * (floor/10 points, floor/49 dice) and clamps so balances never go negative.
 */
async function adjustPointsForRefund(userId: number, oldAmt: number, newAmt: number) {
  if (oldAmt <= newAmt) return;
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { points: true, dicePoints: true, totalSpentTHB: true },
  });
  if (!u) return;
  const dPoints = Math.floor(oldAmt / 10) - Math.floor(newAmt / 10);
  const dDice = Math.floor(oldAmt / 49) - Math.floor(newAmt / 49);
  await db.user.update({
    where: { id: userId },
    data: {
      points: Math.max(0, u.points - dPoints),
      dicePoints: Math.max(0, u.dicePoints - dDice),
      totalSpentTHB: Math.max(0, u.totalSpentTHB - (oldAmt - newAmt)),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const handledById = session?.user?.id ? Number(session.user.id) : undefined;
  const orderId = Number(id);

  // Edit items + note + optional bill change mode
  if ("items" in body) {
    const { items, note, newBillId } = body as {
      items: { id: number; quantity: number }[];
      note?: string;
      newBillId?: number | null;
    };

    const toRemoveIds = items.filter((i) => i.quantity <= 0).map((i) => i.id);
    const toUpdate = items.filter((i) => i.quantity > 0);

    // Fetch order status and items being cancelled to decide soft vs hard delete
    const orderStatus = await db.order.findUnique({
      where: { id: orderId },
      select: { status: true, orderName: true },
    });
    const isActive = orderStatus?.status === "CONFIRMED" || orderStatus?.status === "PAID";

    if (toRemoveIds.length > 0) {
      const cancellingItems = await db.orderItem.findMany({
        where: { id: { in: toRemoveIds } },
        include: { menuItem: { select: { nameTh: true, queueTarget: true } } },
      });

      const now = new Date();
      const inKitchen = isActive
        ? cancellingItems.filter((i) => i.kitchenServedAt == null && i.menuItem.queueTarget !== "none")
        : [];
      const notInKitchen = cancellingItems.filter((i) => !inKitchen.includes(i));

      // Soft-delete items being prepared in kitchen/bar
      if (inKitchen.length > 0) {
        await db.orderItem.updateMany({
          where: { id: { in: inKitchen.map((i) => i.id) } },
          data: { cancelledAt: now },
        });
      }

      // Hard-delete items not being prepared
      if (notInKitchen.length > 0) {
        await db.orderItem.deleteMany({ where: { id: { in: notInKitchen.map((i) => i.id) } } });
      }
    }

    for (const item of toUpdate) {
      await db.orderItem.update({
        where: { id: item.id },
        data: { quantity: item.quantity },
      });
    }

    // Total: only non-cancelled items
    const remaining = await db.orderItem.findMany({
      where: { orderId, cancelledAt: null },
    });
    const totalTHB = remaining.reduce((sum, i) => sum + i.unitPriceTHB * i.quantity, 0);

    const updateData: Record<string, unknown> = { totalTHB, note: note ?? null };
    if (newBillId !== undefined) {
      if (newBillId === null) {
        updateData.billId = null;
      } else {
        // Fetch new bill's table to update tableId too
        const bill = await db.bill.findUnique({ where: { id: newBillId }, select: { tableId: true } });
        updateData.billId = newBillId;
        if (bill?.tableId) updateData.tableId = bill.tableId;
      }
    }

    // Sync the payment to the new total.
    // - PENDING (not yet paid): just update the amount due.
    // - CONFIRMED (already paid) and total dropped: treat as a partial refund —
    //   reduce the recorded amount and reverse the excess loyalty/dice points so
    //   revenue (Σ confirmed payments) reflects what the customer actually keeps.
    const existingPay = await db.payment.findUnique({
      where: { orderId },
      select: { id: true, status: true, amountTHB: true },
    });
    if (existingPay?.status === "PENDING") {
      await db.payment.update({ where: { id: existingPay.id }, data: { amountTHB: totalTHB } });
    } else if (existingPay?.status === "CONFIRMED" && totalTHB < existingPay.amountTHB) {
      const ord = await db.order.findUnique({ where: { id: orderId }, select: { userId: true } });
      await db.payment.update({ where: { id: existingPay.id }, data: { amountTHB: totalTHB } });
      if (ord?.userId) await adjustPointsForRefund(ord.userId, existingPay.amountTHB, totalTHB);
    }

    const order = await db.order.update({
      where: { id: orderId },
      data: updateData,
      include: { items: { include: { menuItem: true } }, payment: true, user: true },
    });

    if (handledById) {
      await db.auditLog.create({
        data: {
          userId: handledById,
          action: "ORDER_EDITED",
          targetType: "Order",
          targetId: order.id,
          detail: `แก้ไขออเดอร์ #${order.id} ของ ${order.orderName}`,
        },
      });
    }

    return NextResponse.json(order);
  }

  // Confirm cash payment (with or without prior payment record)
  if ("confirmCash" in body) {
    const { receivedAmount, changeAmount, amountTHB: amountOverride } = body as { receivedAmount: number; changeAmount?: number; amountTHB?: number };
    const orderFull = await db.order.findUnique({
      where: { id: orderId },
      select: {
        totalTHB: true, userId: true, kitchenServedAt: true,
        orderName: true, tableId: true,
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
    if (!orderFull) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
    const finalTHB = amountOverride != null ? Math.max(0, amountOverride) : orderFull.totalTHB;
    const discountTHB = Math.max(0, orderFull.totalTHB - finalTHB);
    const confirmedAt = new Date();
    const confirmData = {
      method: "CASH" as const,
      amountTHB: finalTHB,
      status: "CONFIRMED",
      confirmedAt,
      receivedAmount,
      changeAmount: changeAmount ?? 0,
    };
    const payment = await db.payment.upsert({
      where: { orderId },
      create: { orderId, ...confirmData },
      update: confirmData,
    });
    await createSessionsFromStaffNote(payment.staffNote);
    // Award loyalty + dice points at payment time (use finalTHB after discount)
    const pts = Math.floor(finalTHB / 10);
    if (orderFull.userId && pts > 0) {
      await db.user.update({
        where: { id: orderFull.userId },
        data: { points: { increment: pts }, totalSpentTHB: { increment: finalTHB } },
      });
    }
    if (orderFull.userId) {
      const dice = Math.floor(finalTHB / 49);
      if (dice > 0) await db.user.update({ where: { id: orderFull.userId }, data: { dicePoints: { increment: dice } } });
    }
    // Only mark SERVED if kitchen has already finished; otherwise PAID (waiting kitchen)
    const newStatus = orderFull.kitchenServedAt ? "SERVED" : "PAID";
    const updated = await db.order.update({
      where: { id: orderId },
      data: { status: newStatus, discountAmount: discountTHB > 0 ? discountTHB : null, ...(handledById ? { handledById } : {}) },
      select: { id: true, orderName: true, status: true },
    });
    if (newStatus === "SERVED" && handledById) await deductStockForOrder(orderId, handledById);
    // Save digital receipt
    const locationLabel = orderFull.bill
      ? `${orderFull.bill.name} · โต๊ะ ${orderFull.bill.table.number}`
      : orderFull.tableId ? `โต๊ะ ${orderFull.tableId}` : "-";
    await db.receipt.upsert({
      where: { orderId },
      create: {
        orderId, orderName: orderFull.orderName ?? "",
        totalTHB: finalTHB, discountAmount: discountTHB > 0 ? discountTHB : null, paymentMethod: "CASH",
        locationLabel, itemsJson: JSON.stringify(orderFull.items), confirmedAt,
      },
      update: {},
    });
    return NextResponse.json(updated);
  }

  // Kitchen marks food done — separate from payment/order-closed status
  if ("kitchenDone" in body) {
    const orderFull = await db.order.findUnique({
      where: { id: orderId },
      select: { status: true, userId: true, totalTHB: true },
    });
    if (!orderFull) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });

    const now = new Date();
    // If payment is already collected (PAID), closing everything now → SERVED
    const nextStatus = orderFull.status === "PAID" ? "SERVED" : orderFull.status;

    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        kitchenServedAt: now,
        status: nextStatus,
        ...(handledById ? { handledById } : {}),
      },
      select: { id: true, orderName: true, status: true, userId: true, totalTHB: true },
    });

    if (nextStatus === "SERVED") {
      if (handledById) await deductStockForOrder(orderId, handledById);
      if (handledById) {
        await db.auditLog.create({
          data: {
            userId: handledById,
            action: "ORDER_SERVED",
            targetType: "Order",
            targetId: orderId,
            detail: `ออเดอร์ #${orderId} ของ ${updated.orderName}`,
          },
        });
      }
    }
    return NextResponse.json(updated);
  }

  // Status update mode
  const { status } = body as { status: string };

  // Cancelling an already-paid order: reverse the points it awarded. Revenue
  // already excludes CANCELLED orders' payments, so this just undoes the perks.
  if (status === "CANCELLED") {
    const [pay, ord] = await Promise.all([
      db.payment.findUnique({ where: { orderId }, select: { status: true, amountTHB: true } }),
      db.order.findUnique({ where: { id: orderId }, select: { userId: true } }),
    ]);
    if (pay?.status === "CONFIRMED" && ord?.userId) {
      await adjustPointsForRefund(ord.userId, pay.amountTHB, 0);
    }
  }

  const order = await db.order.update({
    where: { id: orderId },
    data: {
      status,
      ...(handledById ? { handledById } : {}),
    },
    select: { id: true, orderName: true, status: true, userId: true, totalTHB: true },
  });

  if (status === "SERVED" && handledById) await deductStockForOrder(orderId, handledById);

  if (handledById && AUDIT_ACTIONS[status]) {
    await db.auditLog.create({
      data: {
        userId: handledById,
        action: AUDIT_ACTIONS[status],
        targetType: "Order",
        targetId: order.id,
        detail: `ออเดอร์ #${order.id} ของ ${order.orderName}`,
      },
    });
  }

  return NextResponse.json(order);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const orderId = Number(id);
  const handledById = session?.user?.id ? Number(session.user.id) : undefined;

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderName: true },
  });
  if (!order) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });

  await db.orderItem.deleteMany({ where: { orderId } });
  await db.payment.deleteMany({ where: { orderId } });
  await db.splitPayment.deleteMany({ where: { orderId } });
  await db.order.delete({ where: { id: orderId } });

  if (handledById) {
    await db.auditLog.create({
      data: {
        userId: handledById,
        action: "ORDER_DELETED",
        targetType: "Order",
        targetId: orderId,
        detail: `ลบออเดอร์ #${orderId} ของ ${order.orderName}`,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
