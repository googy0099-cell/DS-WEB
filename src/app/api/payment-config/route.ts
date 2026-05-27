import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const config = await db.paymentConfig.findUnique({ where: { id: 1 } });
  return NextResponse.json(config ?? { id: 1, qrImageUrl: null, accountName: "", bankName: "" });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "เฉพาะ Owner เท่านั้น" }, { status: 403 });
  }
  const { promptPayId, qrImageUrl, accountName, bankName } = await req.json();
  const config = await db.paymentConfig.upsert({
    where: { id: 1 },
    update: {
      ...(promptPayId !== undefined ? { promptPayId } : {}),
      ...(qrImageUrl !== undefined ? { qrImageUrl } : {}),
      ...(accountName !== undefined ? { accountName } : {}),
      ...(bankName !== undefined ? { bankName } : {}),
    },
    create: { id: 1, promptPayId, qrImageUrl, accountName, bankName },
  });
  return NextResponse.json(config);
}
