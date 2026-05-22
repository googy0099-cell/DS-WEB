import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  const users = await db.user.findMany({
    where: {
      role: "USER",
      ...(q
        ? {
            OR: [
              { username: { contains: q } },
              { memberCode: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      email: true,
      memberCode: true,
      phone: true,
      nickname: true,
      instagram: true,
      facebook: true,
      birthday: true,
      avatarUrl: true,
      googleId: true,
      points: true,
      totalSpentTHB: true,
      visitCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(users);
}
