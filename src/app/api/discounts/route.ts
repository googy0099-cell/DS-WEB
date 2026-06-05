import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const discounts = await db.discount.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(discounts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!["OWNER", "CASHIER"].includes(session?.user?.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { nameTh, type, value } = await req.json() as { nameTh: string; type: string; value: number };
  if (!nameTh?.trim() || !value || value <= 0) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  const d = await db.discount.create({
    data: { nameTh: nameTh.trim(), type: type === "PERCENT" ? "PERCENT" : "FIXED", value },
  });
  return NextResponse.json(d);
}
