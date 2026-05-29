import db from "@/lib/db";
import { sendTelegramNotify } from "@/lib/telegram-notify";

export async function deductStockForOrder(orderId: number, performedById: number): Promise<void> {
  // Skip if already deducted for this order
  const existing = await db.stockOutLog.findFirst({ where: { orderId } });
  if (existing) return;

  const orderItems = await db.orderItem.findMany({
    where: { orderId },
    include: {
      menuItem: {
        include: {
          stockRecipes: {
            include: { stockItem: { select: { id: true, name: true, unit: true } } },
          },
        },
      },
    },
  });

  // Aggregate: stockItemId → total deduction
  const deductMap = new Map<number, { qty: number; name: string; unit: string }>();
  for (const oi of orderItems) {
    for (const r of oi.menuItem.stockRecipes) {
      const total = r.qtyUsed * oi.quantity;
      const cur = deductMap.get(r.stockItemId);
      deductMap.set(r.stockItemId, {
        qty: (cur?.qty ?? 0) + total,
        name: r.stockItem.name,
        unit: r.stockItem.unit,
      });
    }
  }

  if (deductMap.size === 0) return;

  const stockIds = Array.from(deductMap.keys());

  await db.$transaction([
    ...Array.from(deductMap.entries()).map(([stockItemId, { qty }]) =>
      db.stockItem.update({ where: { id: stockItemId }, data: { currentQty: { decrement: qty } } })
    ),
    ...Array.from(deductMap.entries()).map(([stockItemId, { qty }]) =>
      db.stockOutLog.create({
        data: { stockItemId, qty, reason: `order_${orderId}`, orderId, createdById: performedById },
      })
    ),
  ]);

  // Check for new low-stock situations and alert
  const updated = await db.stockItem.findMany({ where: { id: { in: stockIds }, isActive: true } });

  for (const item of updated) {
    if (item.currentQty >= item.minQty) continue;
    const alreadyAlerted = await db.stockAlert.findFirst({
      where: { stockItemId: item.id, type: "low_stock", isRead: false },
    });
    if (alreadyAlerted) continue;

    await db.stockAlert.create({
      data: {
        type: "low_stock",
        stockItemId: item.id,
        message: `${item.name} เหลือ ${item.currentQty} ${item.unit} (ขั้นต่ำ ${item.minQty})`,
      },
    });
    await sendTelegramNotify(
      `⚠️ สต็อกต่ำ!\n📦 ${item.name}\nเหลือ: ${item.currentQty} ${item.unit}\nขั้นต่ำ: ${item.minQty} ${item.unit}`
    );
  }
}
