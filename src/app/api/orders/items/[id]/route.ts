import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { deductStockForOrder } from "@/lib/stock-deduct";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;
  const itemId = Number(id);
  const handledById = session?.user?.id ? Number(session.user.id) : undefined;

  const now = new Date();

  // Mark this item as kitchen-done
  const item = await db.orderItem.update({
    where: { id: itemId },
    data: { kitchenServedAt: now },
    select: { orderId: true },
  });

  // Check if ALL non-cancelled items in this order are now kitchen-done
  const allItems = await db.orderItem.findMany({
    where: { orderId: item.orderId, cancelledAt: null },
    select: { kitchenServedAt: true },
  });
  const allDone = allItems.length > 0 && allItems.every((i) => i.kitchenServedAt != null);

  if (allDone) {
    const order = await db.order.findUnique({
      where: { id: item.orderId },
      select: { status: true, userId: true, totalTHB: true },
    });
    const nextStatus = order?.status === "PAID" ? "SERVED" : order?.status ?? "CONFIRMED";
    await db.order.update({
      where: { id: item.orderId },
      data: { kitchenServedAt: now, status: nextStatus, ...(handledById ? { handledById } : {}) },
    });
    if (nextStatus === "SERVED" && handledById) {
      await deductStockForOrder(item.orderId, handledById);
    }
  }

  return NextResponse.json({ ok: true, allDone });
}
