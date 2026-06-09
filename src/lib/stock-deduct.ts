import db from "@/lib/db";

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
  // Per order item: prefer size-specific recipe, fall back to catch-all (size="")
  const deductMap = new Map<number, { qty: number; name: string; unit: string }>();
  for (const oi of orderItems) {
    const size = oi.selectedSize ?? "";
    const sizeSpecific = oi.menuItem.stockRecipes.filter((r) => r.size === size);
    const catchAll = oi.menuItem.stockRecipes.filter((r) => r.size === "");
    const applicable = sizeSpecific.length > 0 ? sizeSpecific : catchAll;
    for (const r of applicable) {
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

    // Auto-close all menu items that use this ingredient
    const affectedRecipes = await db.menuStockRecipe.findMany({
      where: { stockItemId: item.id },
      select: { menuItemId: true, menuItem: { select: { nameTh: true } } },
    });
    let closedMenuNames: string[] = [];
    if (affectedRecipes.length > 0) {
      const menuIds = affectedRecipes.map((r) => r.menuItemId);
      const result = await db.menuItem.findMany({ where: { id: { in: menuIds }, isAvailable: true }, select: { nameTh: true } });
      closedMenuNames = result.map((m) => m.nameTh);
      if (closedMenuNames.length > 0) {
        await db.menuItem.updateMany({ where: { id: { in: menuIds }, isAvailable: true }, data: { isAvailable: false } });
      }
    }

    // Alert (once per item until resolved)
    const alreadyAlerted = await db.stockAlert.findFirst({
      where: { stockItemId: item.id, type: "low_stock", isRead: false },
    });
    if (alreadyAlerted) continue;

    const closedLine = closedMenuNames.length > 0
      ? `\n🚫 ปิดเมนูอัตโนมัติ: ${closedMenuNames.join(", ")}`
      : "";

    // เก็บเป็น stockAlert ในระบบ (ไม่ส่ง Telegram ตามนโยบายห้อง ORDER)
    await db.stockAlert.create({
      data: {
        type: "low_stock",
        stockItemId: item.id,
        message: `${item.name} เหลือ ${item.currentQty} ${item.unit} (ขั้นต่ำ ${item.minQty})${closedLine}`,
      },
    });
  }
}
