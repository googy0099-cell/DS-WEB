import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const tableId = req.nextUrl.searchParams.get("tableId");
  if (!tableId) return NextResponse.json([]);

  const bills = await db.bill.findMany({
    where: { status: "ACTIVE", tableId: Number(tableId) },
    select: { id: true, name: true, table: { select: { number: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    bills.map((b) => ({ id: b.id, name: b.name, tableNumber: b.table.number }))
  );
}
