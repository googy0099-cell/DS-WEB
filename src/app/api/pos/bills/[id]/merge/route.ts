import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { remainingSeconds } from "@/lib/pos-time";

// รวมบิล: ดึงบิลต้นทาง (ที่ยังไม่จ่าย/ACTIVE) เข้ามารวมกับบิลนี้ ([id] = บิลปลายทางที่จะเก็บไว้)
// ย้ายออเดอร์ + ผู้เล่นทั้งหมดไปบิลปลายทาง แล้วลบบิลต้นทางทิ้ง
// แตะเฉพาะความสัมพันธ์ Bill/Order/PlayerSession เท่านั้น — ไม่ยุ่งกับการจ่ายเงิน/แต้ม/สต็อก
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staffSession = await auth();
  if (!staffSession?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(staffSession.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const targetId = Number(id);
  const { sourceBillId } = (await req.json()) as { sourceBillId?: number };

  if (!sourceBillId || !targetId) {
    return NextResponse.json({ error: "ต้องระบุบิลต้นทางและปลายทาง" }, { status: 400 });
  }
  if (sourceBillId === targetId) {
    return NextResponse.json({ error: "รวมบิลเดียวกันไม่ได้" }, { status: 400 });
  }

  try {
    const [target, source] = await Promise.all([
      db.bill.findUnique({ where: { id: targetId }, select: { id: true, status: true, tableId: true } }),
      db.bill.findUnique({
        where: { id: sourceBillId },
        select: {
          id: true, status: true, tableId: true, startsAt: true,
          sessions: { select: { id: true, status: true, timeRemaining: true, updatedAt: true } },
        },
      }),
    ]);

    if (!target || target.status !== "ACTIVE") return NextResponse.json({ error: "บิลปลายทางไม่พร้อมใช้งาน" }, { status: 400 });
    if (!source || source.status !== "ACTIVE") return NextResponse.json({ error: "บิลต้นทางไม่พร้อมใช้งาน" }, { status: 400 });

    // รวมได้เฉพาะบิลต้นทางที่ "ยังไม่ได้ชำระ" — ห้ามรวมบิลที่มีการชำระยืนยันแล้ว (CONFIRMED)
    const paidOrder = await db.order.findFirst({
      where: { billId: sourceBillId, payment: { status: "CONFIRMED" } },
      select: { id: true },
    });
    if (paidOrder) {
      return NextResponse.json({ error: "บิลต้นทางมีการชำระแล้ว รวมไม่ได้" }, { status: 400 });
    }

    const now = Date.now();

    // ย้ายออเดอร์ทั้งหมดไปบิลปลายทาง
    await db.order.updateMany({ where: { billId: sourceBillId }, data: { billId: targetId } });

    // ย้ายผู้เล่นทั้งหมด — snapshot เวลาที่เหลือของคนที่ยังเล่นอยู่ (ACTIVE) เทียบกับ startsAt ของบิลเดิม
    // เพราะบิลปลายทางมีจุดเริ่มนับถอยหลังคนละจุด
    for (const s of source.sessions) {
      if (s.status === "ACTIVE") {
        const current = remainingSeconds(s.timeRemaining, source.startsAt, s.updatedAt, now);
        await db.playerSession.update({
          where: { id: s.id },
          data: { billId: targetId, tableId: target.tableId, timeRemaining: current },
        });
      } else {
        await db.playerSession.update({
          where: { id: s.id },
          data: { billId: targetId, tableId: target.tableId },
        });
      }
    }

    // บิลต้นทางว่างแล้ว → ลบทิ้ง แล้วปลดล็อกโต๊ะเดิมถ้าไม่มีบิลอื่นใช้งานอยู่
    await db.bill.delete({ where: { id: sourceBillId } });
    if (source.tableId !== target.tableId) {
      const others = await db.bill.count({ where: { tableId: source.tableId, status: "ACTIVE" } });
      if (others === 0) {
        await db.table.update({ where: { id: source.tableId }, data: { isOccupied: false } });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/pos/bills/merge]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
