import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const PACKAGES = {
  A: { label: "Package A — สั่งเครื่องดื่ม", price: 0, timeSeconds: 3600, desc: "ได้เล่นฟรี 1 ชม." },
  B: { label: "Package B — 49 บาท", price: 49, timeSeconds: 7200, desc: "เล่น 1 ชม. + ฟรี 1 ชม. = 2 ชม." },
  C: { label: "Package C — เหมาวัน 120 บาท", price: 120, timeSeconds: 86400, desc: "ฟรีเครื่องดื่ม 1 แก้ว ไม่จำกัดเวลา" },
} as const;

export type PackageKey = keyof typeof PACKAGES;

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
