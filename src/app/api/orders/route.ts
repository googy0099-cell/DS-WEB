import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendLineNotify } from "@/lib/line-notify";
import { sendPushToAll } from "@/lib/push-notify";
import { formatThaiTime } from "@/lib/thai-datetime";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let whereClause: Record<string, unknown> = {};
  if (status === "active") {
    whereClause = { status: { in: ["PENDING", "CONFIRMED", "PAID"] } };
  } else if (status === "today") {
    whereClause = {
      status: { in: ["SERVED", "CANCELLED"] },
      createdAt: { gte: today, lt: tomorrow },
    };
  } else if (status) {
    whereClause = { status };
  } else {
    whereClause = { status: { in: ["PENDING", "CONFIRMED", "PAID"] } };
  }

  const orders = await db.order.findMany({
    where: whereClause,
    include: { items: { include: { menuItem: true } }, user: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orderName, userId, items, note } = body as {
    orderName: string;
    userId?: number | null;
    items: {
      menuItemId: number;
      quantity: number;
      selectedSize?: string | null;
      selectedAddons?: { id: number; groupId: number; nameTh: string; priceTHB: number }[];
      selectedOptions?: { groupId: number; groupName: string; choiceId: number; choiceName: string; priceTHB: number }[];
    }[];
    note?: string;
  };

  if (!orderName?.trim() || !items?.length) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  // Duplicate name check: ถ้ามีชื่อซ้ำวันเดียวกัน → append #2, #3
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let finalName = orderName.trim();
  const sameDay = await db.order.findMany({
    where: {
      orderName: { startsWith: finalName },
      createdAt: { gte: today, lt: tomorrow },
    },
  });
  if (sameDay.length > 0) {
    finalName = `${finalName} #${sameDay.length + 1}`;
  }

  const menuItems = await db.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) } },
  });

  const itemsWithPrice = items.map((item) => {
    const menu = menuItems.find((m) => m.id === item.menuItemId)!;
    let basePrice = menu.priceTHB;
    if (item.selectedSize === "S" && menu.priceS) basePrice = menu.priceS;
    if (item.selectedSize === "XL" && menu.priceXL) basePrice = menu.priceXL;
    const addonTotal = (item.selectedAddons ?? []).reduce((s, a) => s + a.priceTHB, 0);
    const optionTotal = (item.selectedOptions ?? []).reduce((s, o) => s + o.priceTHB, 0);
    return {
      ...item,
      unitPriceTHB: basePrice + addonTotal + optionTotal,
      nameTh: menu.nameTh,
    };
  });

  const totalTHB = itemsWithPrice.reduce(
    (sum, i) => sum + i.unitPriceTHB * i.quantity,
    0
  );

  const order = await db.order.create({
    data: {
      orderName: finalName,
      userId: userId ?? null,
      totalTHB,
      note: note || null,
      items: {
        create: itemsWithPrice.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          unitPriceTHB: i.unitPriceTHB,
          selectedSize: i.selectedSize ?? null,
          selectedAddons: i.selectedAddons?.length ? JSON.stringify(i.selectedAddons) : null,
          selectedOptions: i.selectedOptions?.length ? JSON.stringify(i.selectedOptions) : null,
        })),
      },
    },
    include: { items: { include: { menuItem: true } } },
  });

  const itemLines = itemsWithPrice
    .map((i) => {
      const sizePart = i.selectedSize ? ` (${i.selectedSize})` : "";
      const addonPart = i.selectedAddons?.length
        ? " + " + i.selectedAddons.map((a) => a.nameTh).join(", ")
        : "";
      const optionPart = i.selectedOptions?.length
        ? " [" + i.selectedOptions.map((o) => `${o.groupName}: ${o.choiceName}`).join(", ") + "]"
        : "";
      return `  • ${i.nameTh}${sizePart}${addonPart}${optionPart} x${i.quantity} = ฿${i.unitPriceTHB * i.quantity}`;
    })
    .join("\n");

  const lineMsg = `\n🔔 ออเดอร์ใหม่! 👤 ${finalName}\n${itemLines}\n💰 รวม ฿${totalTHB}${note ? `\n📝 หมายเหตุ: ${note}` : ""}\n🕐 ${formatThaiTime(order.createdAt)}`;
  await Promise.allSettled([
    sendLineNotify(lineMsg),
    sendPushToAll("🔔 ออเดอร์ใหม่!", `${finalName} • ฿${totalTHB}`),
  ]);

  return NextResponse.json(order, { status: 201 });
}
