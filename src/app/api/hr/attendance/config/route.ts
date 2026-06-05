import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let config = await db.hrLateConfig.findFirst();
    if (!config) config = await db.hrLateConfig.create({ data: { deductionAmount: 0, absentDeductionAmount: 0 } });
    return NextResponse.json(config);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["MANAGER", "OWNER"].includes(session.user.role ?? ""))
      return NextResponse.json({ error: "ต้องเป็น OWNER" }, { status: 403 });
    const body = await req.json() as { deductionType?: string; deductionAmount?: number; absentDeductionAmount?: number };
    let config = await db.hrLateConfig.findFirst();
    const data: { deductionType?: string; deductionAmount?: number; absentDeductionAmount?: number } = {};
    if (body.deductionType != null && ["FIXED", "PERCENT"].includes(body.deductionType)) data.deductionType = body.deductionType;
    if (body.deductionAmount != null) data.deductionAmount = body.deductionAmount;
    if (body.absentDeductionAmount != null) data.absentDeductionAmount = body.absentDeductionAmount;
    if (!config) {
      config = await db.hrLateConfig.create({ data: { deductionAmount: 0, absentDeductionAmount: 0, ...data } });
    } else {
      config = await db.hrLateConfig.update({ where: { id: config.id }, data });
    }
    return NextResponse.json(config);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
