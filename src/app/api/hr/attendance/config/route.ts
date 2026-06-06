import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let config = await db.hrLateConfig.findFirst();
    if (!config) config = await db.hrLateConfig.create({ data: {} });
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

    const body = await req.json() as {
      deductionType?: string;
      deductionAmount?: number;
      lateDeductionMax?: number;
      absentDeductionAmount?: number;
      absentDeductionType?: string;
      taskDeductionAmount?: number;
      taskDeductionType?: string;
    };

    const data: Record<string, unknown> = {};
    if (body.deductionType != null && ["FIXED", "PERCENT"].includes(body.deductionType)) data.deductionType = body.deductionType;
    if (body.deductionAmount != null) data.deductionAmount = body.deductionAmount;
    if (body.lateDeductionMax != null) data.lateDeductionMax = Math.max(0, body.lateDeductionMax);
    if (body.absentDeductionAmount != null) data.absentDeductionAmount = body.absentDeductionAmount;
    if (body.absentDeductionType != null && ["FIXED", "PERCENT"].includes(body.absentDeductionType)) data.absentDeductionType = body.absentDeductionType;
    if (body.taskDeductionAmount != null) data.taskDeductionAmount = body.taskDeductionAmount;
    if (body.taskDeductionType != null && ["FIXED", "PERCENT"].includes(body.taskDeductionType)) data.taskDeductionType = body.taskDeductionType;

    let config = await db.hrLateConfig.findFirst();
    if (!config) {
      config = await db.hrLateConfig.create({ data: data as Parameters<typeof db.hrLateConfig.create>[0]["data"] });
    } else {
      config = await db.hrLateConfig.update({ where: { id: config.id }, data });
    }
    return NextResponse.json(config);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
