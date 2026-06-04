import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/hr/checklist/config — returns config for both OPEN and CLOSE
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configs = await db.hrChecklistConfig.findMany({ orderBy: { type: "asc" } });
  return NextResponse.json(configs);
}

// PUT /api/hr/checklist/config — update config for a type (OWNER/MANAGER only)
export async function PUT(req: NextRequest) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !["MANAGER", "OWNER"].includes(role))
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });

  const body = await req.json() as { type: string; timeLimitMinutes: number | null; deductionAmount: number };
  const { type, timeLimitMinutes, deductionAmount } = body;

  if (!["OPEN", "CLOSE"].includes(type))
    return NextResponse.json({ error: "type ไม่ถูกต้อง" }, { status: 400 });

  const config = await db.hrChecklistConfig.upsert({
    where: { type },
    create: { type, timeLimitMinutes, deductionAmount: deductionAmount ?? 0 },
    update: { timeLimitMinutes, deductionAmount: deductionAmount ?? 0 },
  });

  return NextResponse.json(config);
}
