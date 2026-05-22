import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: parseInt(session.user.id) },
    include: {
      orders: {
        where: { userId: parseInt(session.user.id) },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, status: true, totalTHB: true, createdAt: true },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}
