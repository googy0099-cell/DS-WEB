import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendTelegramNotify } from "@/lib/telegram-notify";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;
  const body = await req.json();
  const handledById = session?.user?.id ? Number(session.user.id) : undefined;
  const orderId = Number(id);

  // Edit items + note mode
  if ("items" in body) {
    const { items, note } = body as {
      items: { id: number; quantity: number }[];
      note?: string;
    };

    const toDelete = items.filter((i) => i.quantity <= 0).map((i) => i.id);
    const toUpdate = items.filter((i) => i.quantity > 0);

    if (toDelete.length > 0) {
      await db.orderItem.deleteMany({ where: { id: { in: toDelete } } });
    }
    for (const item of toUpdate) {
      await db.orderItem.update({
        where: { id: item.id },
        data: { quantity: item.quantity },
      });
    }

    const remaining = await db.orderItem.findMany({ where: { orderId } });
    const totalTHB = remaining.reduce((sum, i) => sum + i.unitPriceTHB * i.quantity, 0);

    const order = await db.order.update({
      where: { id: orderId },
      data: { totalTHB, note: note ?? null },
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
    const { receivedAmount, changeAmount } = body as { receivedAmount: number; changeAmount?: number };
    const orderFull = await db.order.findUnique({
      where: { id: orderId },
      select: { totalTHB: true, userId: true },
    });
    if (!orderFull) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });
    const confirmData = {
      method: "CASH" as const,
      amountTHB: orderFull.totalTHB,
      status: "CONFIRMED",
      confirmedAt: new Date(),
      receivedAmount,
      changeAmount: changeAmount ?? 0,
    };
    await db.payment.upsert({
      where: { orderId },
      create: { orderId, ...confirmData },
      update: confirmData,
    });
    const pts = Math.floor(orderFull.totalTHB / 10);
    if (orderFull.userId && pts > 0) {
      await db.user.update({
        where: { id: orderFull.userId },
        data: { points: { increment: pts }, totalSpentTHB: { increment: orderFull.totalTHB } },
      });
    }
    if (orderFull.userId) {
      const dice = Math.floor(orderFull.totalTHB / 49);
      if (dice > 0) await db.user.update({ where: { id: orderFull.userId }, data: { dicePoints: { increment: dice } } });
    }
    const served = await db.order.update({
      where: { id: orderId },
      data: { status: "SERVED", ...(handledById ? { handledById } : {}) },
      select: { id: true, orderName: true, status: true },
    });
    await sendTelegramNotify(`💸 รับเงินสดแล้ว\nชื่อ: ${served.orderName} | ฿${orderFull.totalTHB}\nออเดอร์ #${orderId}`);
    return NextResponse.json(served);
  }

  // Status update mode
  const { status } = body as { status: string };

  const order = await db.order.update({
    where: { id: orderId },
    data: {
      status,
      ...(handledById ? { handledById } : {}),
    },
    select: { id: true, orderName: true, status: true, userId: true, totalTHB: true },
  });

  // Award dice points only when cashier confirms payment (SERVED)
  if (status === "SERVED" && order.userId) {
    const diceEarned = Math.floor(order.totalTHB / 49);
    if (diceEarned > 0) {
      await db.user.update({ where: { id: order.userId }, data: { dicePoints: { increment: diceEarned } } });
    }
  }

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

  if (STATUS_LABELS[status]) {
    await sendTelegramNotify(
      `${STATUS_LABELS[status]}\nชื่อ: ${order.orderName} | ออเดอร์ #${order.id}`
    );
  }

  return NextResponse.json(order);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
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
