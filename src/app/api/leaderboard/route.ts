import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "all";

  let dateFilter: Date | undefined;
  const now = new Date();
  if (period === "week") {
    dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "month") {
    dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const members = await db.user.findMany({
    where: {
      role: "USER",
      ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
    },
    orderBy: { points: "desc" },
    take: 20,
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      memberCode: true,
      points: true,
      totalSpentTHB: true,
      visitCount: true,
    },
  });

  return NextResponse.json(members);
}
