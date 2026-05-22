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
  const { status } = await req.json();

  const handledById = session?.user?.id ? Number(session.user.id) : undefined;

  const order = await db.order.update({
    where: { id: Number(id) },
    data: {
      status,
      ...(handledById ? { handledById } : {}),
    },
  });

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
