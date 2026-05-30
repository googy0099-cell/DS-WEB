import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const bills = await db.bill.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, table: { select: { number: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    bills.map((b) => ({ id: b.id, name: b.name, tableNumber: b.table.number }))
  );
}
