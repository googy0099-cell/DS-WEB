import { NextRequest, NextResponse } from "next/server";
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

// DELETE /api/payment?orderId=X — reset payment method so staff can choose again
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orderId = Number(req.nextUrl.searchParams.get("orderId"));
  if (!orderId) return NextResponse.json({ error: "ต้องระบุ orderId" }, { status: 400 });

  try {
    await db.payment.deleteMany({ where: { orderId, status: "PENDING" } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
