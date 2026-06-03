import { NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

const BKK = 7 * 3600_000;

export async function GET() {
  const session = await auth();
  if (!session?.user || !["STAFF", "CASHIER", "OWNER"].includes(session.user.role ?? ""))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date(Date.now() + BKK);
  const dateStr = now.toISOString().slice(0, 10);
  const today = new Date(`${dateStr}T00:00:00+07:00`);
  const tomorrow = new Date(today.getTime() + 86400_000);

  const result: Record<string, { done: number; total: number }> = {
    OPEN: { done: 0, total: 0 },
    CLOSE: { done: 0, total: 0 },
  };

  const checklists = await db.hrChecklist.findMany({
    where: { date: { gte: today, lt: tomorrow } },
    include: { items: { select: { done: true } } },
  });

  for (const cl of checklists) {
    result[cl.type] = {
      done: cl.items.filter((i) => i.done).length,
      total: cl.items.length,
    };
  }

  return NextResponse.json(result);
}
