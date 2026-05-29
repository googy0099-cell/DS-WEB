import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

async function requireStaff() {
  const session = await auth();
  if (!session?.user || !["STAFF", "CASHIER", "OWNER"].includes(session.user.role ?? ""))
    return null;
  return session;
}

export async function GET() {
  if (!(await requireStaff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const alerts = await db.stockAlert.findMany({
    where: { isRead: false },
    include: { stockItem: { select: { id: true, name: true, unit: true, currentQty: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(alerts);
}

export async function PATCH() {
  if (!(await requireStaff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.stockAlert.updateMany({ where: { isRead: false }, data: { isRead: true } });
  return NextResponse.json({ ok: true });
}
