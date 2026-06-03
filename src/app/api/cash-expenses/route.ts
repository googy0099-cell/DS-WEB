import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

function parseBounds(from: string, to: string) {
  return {
    start: new Date(from + "T00:00:00+07:00"),
    end: new Date(to + "T23:59:59+07:00"),
  };
}
function todayBKK() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = req.nextUrl;
  const today = todayBKK();
  const from = searchParams.get("from") || today;
  const to = searchParams.get("to") || today;
  const { start, end } = parseBounds(from, to);
  const expenses = await db.cashExpense.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { type, amount, description, photoUrl, note } = (await req.json()) as {
    type: string; amount: number; description: string; photoUrl?: string; note?: string;
  };
  if (!type || !amount || !description) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  const expense = await db.cashExpense.create({ data: { type, amount, description, photoUrl, note } });
  return NextResponse.json(expense);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, reimbursed } = (await req.json()) as { id: number; reimbursed: boolean };
  const expense = await db.cashExpense.update({ where: { id }, data: { reimbursed } });
  return NextResponse.json(expense);
}
