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

// เงินสดที่เติมเข้าเก๊ะระหว่างวัน — เพิ่มยอดเงินที่ควรมีในเก๊ะ (ไม่ใช่รายได้)
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
  const topups = await db.cashTopup.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(topups);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { amount, description, photoUrl, note } = (await req.json()) as {
    amount: number; description: string; photoUrl?: string; note?: string;
  };
  if (!amount || amount <= 0 || !description?.trim()) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  const createdById = session.user.id ? Number(session.user.id) : null;
  const topup = await db.cashTopup.create({
    data: { amount, description: description.trim(), photoUrl, note, createdById },
  });
  return NextResponse.json(topup);
}
