import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

// POST — set discount on a bill (computes discountAmount from current tab total)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!["CASHIER", "STAFF", "OWNER"].includes(session?.user?.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const billId = Number(id);
    const { discountType, discountValue, discountNote } = await req.json() as {
      discountType: "PERCENT" | "FIXED";
      discountValue: number;
      discountNote?: string;
    };

    if (!discountType || !discountValue || discountValue <= 0) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    // Compute discount amount from current tab total
    const orders = await db.order.findMany({
      where: { billId, payment: { method: "TAB", status: "PENDING" } },
      select: { totalTHB: true },
    });
    const tabTotal = orders.reduce((s, o) => s + o.totalTHB, 0);

    let discountAmount = 0;
    if (discountType === "PERCENT") {
      discountAmount = Math.round(tabTotal * Math.min(discountValue, 100) / 100);
    } else {
      discountAmount = Math.min(discountValue, tabTotal);
    }

    await db.bill.update({
      where: { id: billId },
      data: { discountType, discountValue, discountAmount, discountNote: discountNote ?? null },
    });

    return NextResponse.json({ discountAmount });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE — remove discount from bill
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!["CASHIER", "STAFF", "OWNER"].includes(session?.user?.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db.bill.update({
    where: { id: Number(id) },
    data: { discountType: null, discountValue: null, discountAmount: null, discountNote: null },
  });
  return NextResponse.json({ ok: true });
}
