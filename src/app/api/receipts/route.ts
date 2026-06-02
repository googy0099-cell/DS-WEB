import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (role !== "OWNER" && role !== "CASHIER" && role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = 20;

  const fromDate = from ? new Date(from + "T00:00:00+07:00") : undefined;
  const toDate = to ? new Date(to + "T23:59:59+07:00") : undefined;

  const where = {
    ...(fromDate || toDate
      ? { confirmedAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {}),
  };

  const [receipts, total] = await Promise.all([
    db.receipt.findMany({
      where,
      orderBy: { confirmedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.receipt.count({ where }),
  ]);

  return NextResponse.json({
    receipts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
