import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { notifyShopOpen } from "@/lib/telegram-notify";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { openingFloat } = (await req.json()) as { openingFloat: number };
  notifyShopOpen(openingFloat ?? 0).catch(() => {});
  return NextResponse.json({ ok: true });
}
