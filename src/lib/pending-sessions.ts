import db from "@/lib/db";
import { PACKAGES, type PackageKey } from "@/app/api/pos/sessions/route";

type PendingPlayer = {
  nameOrCode?: string;
  packageType: string;
  drinkName?: string;
  drinkPrice?: number;
  qty?: number;
};

type PendingExtra = {
  menuItemId: number;
  qty: number;
  unitPriceTHB: number;
  assignedPlayerIdx: number | null;
};

type PendingData = {
  billId: number;
  tableId: number;
  players: PendingPlayer[];
  extraItems?: PendingExtra[];
};

/**
 * Given a Payment.staffNote that may contain serialized pending player data,
 * create the PlayerSession records on the linked bill. No-op if staffNote is
 * empty, not JSON, or the bill is no longer ACTIVE.
 */
export async function createSessionsFromStaffNote(staffNote: string | null): Promise<void> {
  if (!staffNote) return;

  let pending: PendingData;
  try {
    pending = JSON.parse(staffNote) as PendingData;
  } catch {
    return; // staffNote is a plain note, not pending player data
  }
  if (!pending?.players?.length) return;

  const bill = await db.bill.findUnique({ where: { id: pending.billId } });
  if (!bill || bill.status !== "ACTIVE") return;

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
