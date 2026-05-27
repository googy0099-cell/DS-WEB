import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { PACKAGES, type PackageKey } from "@/app/api/pos/sessions/route";
import { generatePromptPayQR } from "@/lib/promptpay";

type PlayerInput = { nameOrCode?: string; packageType: PackageKey };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const billId = Number(id);
  const { players } = (await req.json()) as { players: PlayerInput[] };

  const bill = await db.bill.findUnique({ where: { id: billId } });
  if (!bill || bill.status !== "ACTIVE") {
    return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });
  }
  if (!Array.isArray(players) || players.length === 0) {
    return NextResponse.json({ error: "ต้องมีผู้เล่นอย่างน้อย 1 คน" }, { status: 400 });
  }

  // Find current player count in this bill (so labels continue)
  const existingCount = await db.playerSession.count({ where: { billId } });

  let total = 0;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const pkg = PACKAGES[p.packageType];
    if (!pkg) return NextResponse.json({ error: "แพ็กเกจไม่ถูกต้อง" }, { status: 400 });

    const raw = p.nameOrCode?.trim() ?? "";
    let userId: number | null = null;
    let nickname = raw || `Player ${existingCount + i + 1}`;

    if (raw) {
      const member = await db.user.findUnique({
        where: { memberCode: raw.toUpperCase() },
        select: { id: true, username: true },
      });
      if (member) {
        userId = member.id;
        nickname = member.username;
      }
    }

    await db.playerSession.create({
      data: {
        tableId: bill.tableId,
        billId,
        nickname,
        packageType: p.packageType,
        packagePrice: pkg.price,
        timeRemaining: pkg.timeSeconds,
        userId,
      },
    });
    total += pkg.price;
  }

  const qrDataUrl = total > 0 ? await generatePromptPayQR(total) : null;
  return NextResponse.json({ totalTHB: total, qrDataUrl });
}
