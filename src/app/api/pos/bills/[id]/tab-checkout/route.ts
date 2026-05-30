import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const orders = await db.order.findMany({
    where: {
      billId: Number(id),
      status: { in: ["PENDING", "CONFIRMED"] },
      payment: { method: "TAB", status: "PENDING" },
    },
    include: {
      items: {
        include: { menuItem: { select: { nameTh: true } } },
      },
      payment: { select: { id: true, amountTHB: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const tabTotal = orders.reduce((sum, o) => sum + o.totalTHB, 0);
  return NextResponse.json({ orders, tabTotal });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { memberUserId } = await req.json();

  const orders = await db.order.findMany({
    where: {
      billId: Number(id),
      status: { in: ["PENDING", "CONFIRMED"] },
      payment: { method: "TAB", status: "PENDING" },
    },
    include: { payment: { select: { id: true, amountTHB: true } } },
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: "ไม่มีออเดอร์ในแท็บ" }, { status: 400 });
  }

  const tabTotal = orders.reduce((sum, o) => sum + o.totalTHB, 0);
  const now = new Date();

  await db.$transaction([
    ...orders.map((o) =>
      db.payment.update({
        where: { id: o.payment!.id },
        data: { status: "CONFIRMED", confirmedAt: now },
      })
    ),
    ...orders.map((o) =>
      db.order.update({ where: { id: o.id }, data: { status: "SERVED" } })
    ),
  ]);

  let pointsAwarded = 0;
  if (memberUserId) {
    const pts = Math.floor(tabTotal / 10);
    const dice = Math.floor(tabTotal / 49);
    await db.user.update({
      where: { id: Number(memberUserId) },
      data: {
        points: { increment: pts },
        totalSpentTHB: { increment: tabTotal },
        ...(dice > 0 ? { dicePoints: { increment: dice } } : {}),
      },
    });
    pointsAwarded = pts;
  }

  return NextResponse.json({ tabTotal, ordersCount: orders.length, pointsAwarded });
}
