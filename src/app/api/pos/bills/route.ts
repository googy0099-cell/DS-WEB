import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { PREP_SECONDS, remainingSeconds, prepRemaining } from "@/lib/pos-time";
import { notifyPartyOpen } from "@/lib/telegram-notify";

export async function GET() {
  const bills = await db.bill.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true, name: true, color: true, status: true,
      tableId: true, startsAt: true, createdAt: true, updatedAt: true,
      table: { select: { number: true } },
      sessions: {
        where: { status: "ACTIVE" },
        select: {
          id: true, tableId: true, nickname: true, packageType: true,
          packagePrice: true, timeRemaining: true, status: true,
          userId: true, billId: true, createdAt: true, updatedAt: true,
          user: { select: { id: true, username: true, memberCode: true, firstName: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      orders: {
        where: { payment: { method: "UNSET", status: "PENDING" } },
        select: {
          id: true, totalTHB: true,
          payment: { select: { id: true, staffNote: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // บิลไหน "ชำระแล้ว" บ้าง = มีออเดอร์ที่ payment ยืนยันแล้ว (CONFIRMED) อย่างน้อย 1 อัน
  // ใช้คัดว่ารวมบิลได้เฉพาะการ์ดที่ "ยังไม่ได้ชำระ"
  const paidBillIds = new Set(
    (
      await db.order.findMany({
        where: { billId: { in: bills.map((b) => b.id) }, payment: { status: "CONFIRMED" } },
        select: { billId: true },
        distinct: ["billId"],
      })
    ).map((o) => o.billId)
  );

  const now = Date.now();
  const result = bills.map((b) => ({
    ...b,
    isPaid: paidBillIds.has(b.id),
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
  const staffSession = await auth();
  if (!staffSession?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(staffSession.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    select: { id: true, name: true, color: true, tableId: true, startsAt: true, status: true, createdAt: true, updatedAt: true },
  });

  await db.table.update({ where: { id: tableId }, data: { isOccupied: true }, select: { id: true } });

  notifyPartyOpen({ name: bill.name, tableNumber: table.number }).catch(() => {});

  return NextResponse.json(bill, { status: 201 });
}
