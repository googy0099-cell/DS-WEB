import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["STAFF", "CASHIER", "OWNER"].includes(session.user.role ?? ""))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stockItemId, qty, note } = await req.json() as {
    stockItemId: number; qty: number; note?: string;
  };

  if (!stockItemId || !qty || qty <= 0)
    return NextResponse.json({ error: "stockItemId และ qty จำเป็น" }, { status: 400 });

  const userId = Number(session.user.id);

  const [updated] = await db.$transaction([
    db.stockItem.update({
      where: { id: stockItemId },
      data: { currentQty: { increment: qty } },
    }),
    db.stockInLog.create({
      data: { stockItemId, qty, note: note ?? null, createdById: userId },
    }),
  ]);

  // Clear low_stock alert if now above minQty
  if (updated.currentQty >= updated.minQty) {
    await db.stockAlert.deleteMany({
      where: { stockItemId, type: "low_stock", isRead: false },
    });
  }

  return NextResponse.json(updated);
}
