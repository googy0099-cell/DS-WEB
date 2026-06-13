import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { PACKAGES, type PackageKey } from "@/lib/pos-packages";

export async function GET(req: NextRequest) {
  const tableId = Number(new URL(req.url).searchParams.get("tableId"));
  if (!tableId) return NextResponse.json({ error: "ต้องระบุ tableId" }, { status: 400 });

  const sessions = await db.playerSession.findMany({
    where: { tableId, status: "ACTIVE" },
    include: {
      orders: {
        where: { status: { in: ["PENDING", "CONFIRMED"] } },
        include: { items: { include: { menuItem: { select: { nameTh: true, priceTHB: true, priceS: true, category: true } } } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const { tableId, nickname, packageType, memberCode } = await req.json() as {
    tableId: number;
    nickname: string;
    packageType: PackageKey;
    memberCode?: string;
  };

  if (!tableId || !nickname?.trim() || !PACKAGES[packageType]) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  let userId: number | null = null;
  if (memberCode?.trim()) {
    const member = await db.user.findUnique({
      where: { memberCode: memberCode.trim().toUpperCase() },
      select: { id: true },
    });
    if (!member) {
      return NextResponse.json({ error: "ไม่พบรหัสสมาชิกนี้" }, { status: 400 });
    }
    userId = member.id;
  }

  const pkg = PACKAGES[packageType];
  const session = await db.playerSession.create({
    data: {
      tableId,
      nickname: nickname.trim(),
      packageType,
      packagePrice: pkg.price,
      timeRemaining: pkg.timeSeconds,
      userId,
    },
  });

  await db.table.update({ where: { id: tableId }, data: { isOccupied: true } });

  return NextResponse.json(session, { status: 201 });
}
