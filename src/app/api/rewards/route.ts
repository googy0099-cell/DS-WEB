import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
  const items = await db.rewardItem.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const { nameTh, description, cost, imageUrl } = await req.json();
  if (!nameTh?.trim() || !cost || cost < 1) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  const item = await db.rewardItem.create({
    data: { nameTh: nameTh.trim(), description: description?.trim() ?? "", cost: Number(cost), imageUrl: imageUrl ?? null },
  });
  return NextResponse.json(item, { status: 201 });
}
