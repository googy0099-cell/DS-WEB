import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// GET /api/pos/sessions/lookup?billId=X&userId=Y
// Returns the active PlayerSession for a member in a given bill, or null
export async function GET(req: NextRequest) {
  const billId = req.nextUrl.searchParams.get("billId");
  const userId = req.nextUrl.searchParams.get("userId");

  if (!billId || !userId) {
    return NextResponse.json(null);
  }

  const session = await db.playerSession.findFirst({
    where: {
      billId: Number(billId),
      userId: Number(userId),
      status: "ACTIVE",
    },
    select: { id: true, nickname: true, userId: true },
  });

  return NextResponse.json(session ?? null);
}
