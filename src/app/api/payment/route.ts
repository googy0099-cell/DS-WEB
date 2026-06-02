import { NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payments = await db.payment.findMany({
    where: { status: "PENDING" },
    include: {
      order: {
        include: { items: { include: { menuItem: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(payments);
}
