import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

function todayBounds() {
  const now = new Date();
  const offsetMs = (7 * 60 + now.getTimezoneOffset()) * 60_000;
  const bkkNow = new Date(now.getTime() + offsetMs);
  const startBkk = new Date(bkkNow); startBkk.setHours(0, 0, 0, 0);
  const endBkk = new Date(startBkk); endBkk.setDate(endBkk.getDate() + 1);
  return { start: new Date(startBkk.getTime() - offsetMs), end: new Date(endBkk.getTime() - offsetMs) };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { start, end } = todayBounds();
  const expenses = await db.cashExpense.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "asc" },
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
