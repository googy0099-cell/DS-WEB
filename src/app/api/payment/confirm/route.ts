import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendTelegramNotify } from "@/lib/telegram-notify";
import { sendFcmNotify } from "@/lib/fcm-notify";
import { PACKAGES, type PackageKey } from "@/app/api/pos/sessions/route";

export async function PATCH(req: NextRequest) {
  const { paymentId, userId, receivedAmount, changeAmount } = await req.json();

  const payment = await db.payment.update({
    where: { id: Number(paymentId) },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      ...(receivedAmount != null ? { receivedAmount, changeAmount: changeAmount ?? 0 } : {}),
    },
  });

  const order = await db.order.update({
    where: { id: payment.orderId },
    data: { status: "SERVED" },
    select: { orderName: true, userId: true, totalTHB: true },
  });

  // Award loyalty points (1 per 10 THB) on cashier confirmation
  if (userId) {
    const pts = Math.floor(payment.amountTHB / 10);
    await db.user.update({
      where: { id: Number(userId) },
      data: {
        points: { increment: pts },
        totalSpentTHB: { increment: payment.amountTHB },
      },
    });
  }

  if (order.userId) {
    const diceEarned = Math.floor(order.totalTHB / 49);
    if (diceEarned > 0) {
      await db.user.update({ where: { id: order.userId }, data: { dicePoints: { increment: diceEarned } } });
    }
  }

  // If staffNote contains pending player data, create sessions now
  if (payment.staffNote) {
    try {
      const pending = JSON.parse(payment.staffNote) as {
        billId: number;
        tableId: number;
        players: { nameOrCode?: string; packageType: string; drinkName?: string; drinkPrice?: number; qty?: number }[];
        extraItems?: { menuItemId: number; qty: number; unitPriceTHB: number; assignedPlayerIdx: number | null }[];
      };

      const bill = await db.bill.findUnique({ where: { id: pending.billId } });
      if (bill && bill.status === "ACTIVE") {
        const existingCount = await db.playerSession.count({ where: { billId: pending.billId } });
        const createdSessionIds: number[] = [];

        for (let i = 0; i < pending.players.length; i++) {
          const p = pending.players[i];
          const pkg = PACKAGES[p.packageType as PackageKey];
          if (!pkg) continue;

          const qty = p.packageType === "B" ? Math.max(1, p.qty ?? 1) : 1;
          const raw = p.nameOrCode?.trim() ?? "";
          let linkedUserId: number | null = null;
          let nickname = raw || `Player ${existingCount + i + 1}`;

          if (raw) {
            const member = await db.user.findUnique({
              where: { memberCode: raw.toUpperCase() },
              select: { id: true, username: true },
            });
            if (member) { linkedUserId = member.id; nickname = member.username; }
          }

          const drinkNote = p.drinkName?.trim();
          if (drinkNote) nickname = `${nickname} (${drinkNote})`;

          const drinkCharge = p.packageType === "A" ? Math.max(0, p.drinkPrice ?? 0) : 0;
          const price = pkg.price * qty + drinkCharge;
          const timeSeconds = pkg.timeSeconds * qty;

          const session = await db.playerSession.create({
            data: {
              tableId: pending.tableId,
              billId: pending.billId,
              nickname,
              packageType: p.packageType,
              packagePrice: price,
              timeRemaining: timeSeconds,
              userId: linkedUserId,
            },
          });
          createdSessionIds.push(session.id);
        }

        // Apply extra spend per assigned player
        for (const e of pending.extraItems ?? []) {
          if (e.assignedPlayerIdx !== null) {
            const sid = createdSessionIds[e.assignedPlayerIdx];
            if (sid) {
              await db.playerSession.update({
                where: { id: sid },
                data: { packagePrice: { increment: e.unitPriceTHB * e.qty } },
              });
            }
          }
        }
      }
    } catch {
      // staffNote is not JSON (regular note) — skip
    }
  }

  await Promise.allSettled([
    sendTelegramNotify(`💸 ได้รับเงินแล้ว\nชื่อ: ${order.orderName} | ฿${payment.amountTHB}\nออเดอร์ #${payment.orderId}`),
    sendFcmNotify("💸 ได้รับเงินแล้ว!", `${order.orderName} • ฿${payment.amountTHB}`),
  ]);

  return NextResponse.json(payment);
}
