import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { sendTelegramNotify } from "@/lib/telegram-notify";
import { remainingSeconds } from "@/lib/pos-time";

const REDEEM_COST = 10;

const REDEEM_LABEL: Record<string, string> = {
  A: "Package A — น้ำ 1 แก้ว + เล่นฟรี 1 ชม.",
  B: "Package B — เล่น 2 ชม.",
};

const REDEEM_SECS: Record<string, number> = { A: 3600, B: 7200 };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const userId = parseInt(session.user.id);
  const body = (await req.json()) as {
    packageType: string;
    drinkMenuItemId?: number;
    drinkName?: string;
    drinkUnitPrice?: number;
    drinkSize?: string | null;
    drinkAddons?: string | null;
    drinkOptions?: string | null;
  };

  const { packageType } = body;
  if (!REDEEM_LABEL[packageType]) return NextResponse.json({ error: "ประเภทรางวัลไม่ถูกต้อง" }, { status: 400 });
  if (packageType === "A" && !body.drinkMenuItemId) {
    return NextResponse.json({ error: "กรุณาเลือกเครื่องดื่ม" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, dicePoints: true, firstName: true, memberCode: true, username: true },
  });
  if (!user) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
  if (user.dicePoints < REDEEM_COST) {
    return NextResponse.json({ error: `ลูกเต๋าไม่พอ (ต้องการ ${REDEEM_COST} ลูก)` }, { status: 400 });
  }

  // Look up gametime menu item
  const gametimeItem = await db.menuItem.findFirst({
    where: { nameEn: `gametime-${packageType}` },
  });

  // Build order line items
  const orderItems: { menuItemId: number; quantity: number; unitPriceTHB: number; selectedSize?: string | null; selectedAddons?: string | null; selectedOptions?: string | null }[] = [];

  if (gametimeItem) {
    orderItems.push({ menuItemId: gametimeItem.id, quantity: 1, unitPriceTHB: 0 });
  }

  if (packageType === "A" && body.drinkMenuItemId) {
    orderItems.push({
      menuItemId: body.drinkMenuItemId,
      quantity: 1,
      unitPriceTHB: 0,
      selectedSize: body.drinkSize ?? null,
      selectedAddons: body.drinkAddons ?? null,
      selectedOptions: body.drinkOptions ?? null,
    });
  }

  // Create order for cashier
  const order = await db.order.create({
    data: {
      orderName: `แลกแต้ม 🎲 — ${user.firstName} (${user.memberCode})`,
      userId,
      totalTHB: 0,
      note: `แลกด้วยแต้มลูกเต๋า 🎲 | ${REDEEM_LABEL[packageType]}`,
      status: "PENDING",
      items: orderItems.length > 0 ? { create: orderItems } : undefined,
    },
  });

  // Add time to active session (if any)
  const activeSession = await db.playerSession.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { bill: true },
    orderBy: { createdAt: "desc" },
  });

  if (activeSession) {
    const startsAt = activeSession.bill?.startsAt ?? activeSession.createdAt;
    const current = remainingSeconds(activeSession.timeRemaining, startsAt, activeSession.updatedAt);
    await db.playerSession.update({
      where: { id: activeSession.id },
      data: { timeRemaining: current + REDEEM_SECS[packageType] },
    });
  }

  // Deduct dice
  await db.user.update({ where: { id: userId }, data: { dicePoints: { decrement: REDEEM_COST } } });

  // Telegram notify
  const drinkInfo = packageType === "A" && body.drinkName ? ` | เครื่องดื่ม: ${body.drinkName}` : "";
  await sendTelegramNotify(
    `🎲 แลกรางวัล! ออเดอร์ #${order.id}\n👤 ${user.firstName} (@${user.username}) รหัส ${user.memberCode}\n🎁 ${REDEEM_LABEL[packageType]}${drinkInfo}\nใช้ ${REDEEM_COST} ลูกเต๋า`
  ).catch(() => {});

  return NextResponse.json({ ok: true, label: REDEEM_LABEL[packageType], cost: REDEEM_COST, orderId: order.id, timeAdded: activeSession ? REDEEM_SECS[packageType] : 0 });
}
