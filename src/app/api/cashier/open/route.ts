import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { notifyShopOpen } from "@/lib/telegram-notify";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { openingFloat } = (await req.json()) as { openingFloat: number };
  // Persist the opening float so it survives midnight rollover / device switch
  // (only touches openingFloat — isOpen/openedAt are managed by stock/session)
  await db.shopSession.upsert({
    where: { id: 1 },
    create: { id: 1, openingFloat: openingFloat ?? 0 },
    update: { openingFloat: openingFloat ?? 0 },
  }).catch(() => {});
  notifyShopOpen(openingFloat ?? 0).catch(() => {});
  return NextResponse.json({ ok: true });
}
