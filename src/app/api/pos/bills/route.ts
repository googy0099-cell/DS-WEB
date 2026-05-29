import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { PREP_SECONDS, remainingSeconds, prepRemaining } from "@/lib/pos-time";

export async function GET() {
  const bills = await db.bill.findMany({
    where: { status: "ACTIVE" },
    include: {
      table: { select: { number: true } },
      sessions: {
        where: { status: "ACTIVE" },
        include: { user: { select: { id: true, username: true, memberCode: true, firstName: true } } },
        orderBy: { createdAt: "asc" },
      },
      orders: {
        where: { status: "PENDING", payment: { status: "PENDING", method: "CASH" } },
        select: { id: true, totalTHB: true, payment: { select: { id: true, staffNote: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = Date.now();
  const result = bills.map((b) => ({
    ...b,
    prepRemaining: prepRemaining(b.startsAt, now),
    sessions: b.sessions.map((s) => ({
      ...s,
      timeRemaining: remainingSeconds(s.timeRemaining, b.startsAt, s.updatedAt, now),
    })),
    pendingCash: b.orders.map((o) => ({
      orderId: o.id,
      totalTHB: o.totalTHB,
      paymentId: o.payment?.id ?? null,
      staffNote: o.payment?.staffNote ?? null,
    })),
  }));

  return NextResponse.json(result);
}

const BILL_COLORS = ["indigo", "emerald", "rose", "amber", "violet", "teal", "sky", "pink"];

export async function POST(req: NextRequest) {
  const { name, tableId, color } = (await req.json()) as { name?: string; tableId?: number; color?: string };

  if (!name?.trim() || !tableId) {
    return NextResponse.json({ error: "ต้องระบุชื่อบิลและโต๊ะ" }, { status: 400 });
  }

  const table = await db.table.findUnique({ where: { id: tableId } });
  if (!table) return NextResponse.json({ error: "ไม่พบโต๊ะ" }, { status: 400 });

  // Auto-cycle color based on active bill count if no color provided
  let billColor = color ?? "indigo";
  if (!color) {
    const count = await db.bill.count({ where: { status: "ACTIVE" } });
    billColor = BILL_COLORS[count % BILL_COLORS.length];
  }

  const startsAt = new Date(Date.now() + PREP_SECONDS * 1000);
  const bill = await db.bill.create({
    data: { name: name.trim(), tableId, startsAt, color: billColor },
  });

  await db.table.update({ where: { id: tableId }, data: { isOccupied: true } });

  return NextResponse.json(bill, { status: 201 });
}
