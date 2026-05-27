import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// Categories that grant +1 hour of play time per drink ordered
const TIME_ELIGIBLE_CATEGORIES = ["coffee", "milktea", "soda"];
const BONUS_SECONDS_PER_DRINK = 3600;

function syncedRemaining(timeRemaining: number, updatedAt: Date): number {
  const elapsed = Math.floor((Date.now() - updatedAt.getTime()) / 1000);
  return Math.max(0, timeRemaining - elapsed);
}

type OrderItemInput = {
  menuItemId: number;
  quantity: number;
  selectedSize?: string | null;
  selectedAddons?: string | null;
  selectedOptions?: string | null;
};

export async function POST(req: NextRequest) {
  const { sessionId, items, note } = await req.json() as {
    sessionId: number;
    items: OrderItemInput[];
    note?: string;
  };

  if (!sessionId || !items?.length) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ (sessionId + items)" }, { status: 400 });
  }

  const session = await db.playerSession.findUnique({
    where: { id: sessionId, status: "ACTIVE" },
    include: { table: true },
  });
  if (!session) return NextResponse.json({ error: "ไม่พบ Session" }, { status: 404 });

  // Fetch menu items to calculate prices and check categories
  const menuItemIds = items.map((i) => i.menuItemId);
  const menuItems = await db.menuItem.findMany({
    where: { id: { in: menuItemIds } },
  });
  const menuMap = new Map(menuItems.map((m) => [m.id, m]));

  let totalTHB = 0;
  let bonusSeconds = 0;

  const orderItems = items.map((item) => {
    const menu = menuMap.get(item.menuItemId);
    if (!menu) throw new Error(`ไม่พบเมนู ${item.menuItemId}`);

    let unitPrice = menu.priceTHB;
    if (item.selectedSize === "S" && menu.priceS) unitPrice = menu.priceS;
    if (item.selectedSize === "XL" && menu.priceXL) unitPrice = menu.priceXL;

    totalTHB += unitPrice * item.quantity;

    // Count time bonuses
    if (TIME_ELIGIBLE_CATEGORIES.includes(menu.category)) {
      bonusSeconds += BONUS_SECONDS_PER_DRINK * item.quantity;
    }

    return {
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPriceTHB: unitPrice,
      selectedSize: item.selectedSize ?? null,
      selectedAddons: item.selectedAddons ?? null,
      selectedOptions: item.selectedOptions ?? null,
    };
  });

  // Find or create active order for this session
  let order = await db.order.findFirst({
    where: { playerSessionId: sessionId, status: { in: ["PENDING", "CONFIRMED"] } },
  });

  if (order) {
    // Append to existing order
    await db.orderItem.createMany({ data: orderItems.map((oi) => ({ ...oi, orderId: order!.id })) });
    order = await db.order.update({
      where: { id: order.id },
      data: { totalTHB: { increment: totalTHB } },
    });
  } else {
    order = await db.order.create({
      data: {
        orderName: session.nickname,
        tableId: session.tableId,
        playerSessionId: sessionId,
        totalTHB,
        note: note ?? null,
        items: { create: orderItems },
      },
    });
  }

  // Apply time bonus to the player session
  if (bonusSeconds > 0) {
    const current = syncedRemaining(session.timeRemaining, session.updatedAt);
    await db.playerSession.update({
      where: { id: sessionId },
      data: { timeRemaining: current + bonusSeconds },
    });
  }

  return NextResponse.json({ order, bonusSeconds }, { status: 201 });
}
