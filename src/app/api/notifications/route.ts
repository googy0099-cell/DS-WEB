import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.user.id);
  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json(notifications);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseInt(session.user.id);
  const { ids } = (await req.json()) as { ids?: number[] };

  if (ids?.length) {
    await db.notification.updateMany({ where: { userId, id: { in: ids } }, data: { isRead: true } });
  } else {
    await db.notification.updateMany({ where: { userId }, data: { isRead: true } });
  }

  return NextResponse.json({ ok: true });
}
