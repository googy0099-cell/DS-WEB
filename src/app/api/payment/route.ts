import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
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
