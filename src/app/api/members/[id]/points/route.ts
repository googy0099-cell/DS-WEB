import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { points, spentTHB } = await req.json();

  const user = await db.user.update({
    where: { id: Number(id) },
    data: {
      points: { increment: points ?? 0 },
      totalSpentTHB: { increment: spentTHB ?? 0 },
    },
  });

  return NextResponse.json(user);
}
