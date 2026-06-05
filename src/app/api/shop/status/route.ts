import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const session = await db.shopSession.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    isOpen: session?.isOpen ?? false,
    openedAt: session?.openedAt ?? null,
  });
}
