import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const from = searchParams.get("from") || today;
  const to = searchParams.get("to") || today;
  const status = searchParams.get("status") || "";
  const type = searchParams.get("type") || ""; // "dine-in" | "online" | ""
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = 20;

  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = new Date(Date.UTC(fy, fm - 1, fd, -7, 0, 0));
  const end = new Date(Date.UTC(ty, tm - 1, td + 1, -7, 0, 0));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { createdAt: { gte: start, lt: end } };
  if (status) where.status = status;
  if (type === "dine-in") where.billId = { not: null };
  else if (type === "online") where.billId = null;

  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, orderName: true, status: true, totalTHB: true, discountAmount: true,
        createdAt: true, billId: true,
        payment: { select: { method: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  return NextResponse.json({ orders, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
