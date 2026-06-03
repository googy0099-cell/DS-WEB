import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

const PAY_TYPES = ["MONTHLY", "DAILY", "HOURLY"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!["CASHIER", "OWNER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json()) as { faceData?: string; baseSalary?: number; payType?: string };

  const data: { faceData?: string; baseSalary?: number; payType?: string } = {};
  if (typeof body.faceData === "string") data.faceData = body.faceData;
  if (typeof body.baseSalary === "number" || typeof body.payType === "string") {
    if (role !== "OWNER") {
      return NextResponse.json({ error: "OWNER only" }, { status: 403 });
    }
    if (typeof body.baseSalary === "number") {
      if (body.baseSalary < 0) return NextResponse.json({ error: "อัตราต้องไม่ติดลบ" }, { status: 400 });
      data.baseSalary = body.baseSalary;
    }
    if (typeof body.payType === "string") {
      if (!PAY_TYPES.includes(body.payType)) return NextResponse.json({ error: "payType ไม่ถูกต้อง" }, { status: 400 });
      data.payType = body.payType;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "ไม่มีข้อมูลอัปเดต" }, { status: 400 });
  }

  const staff = await db.hrStaff.update({ where: { id: Number(id) }, data });
  return NextResponse.json({ id: staff.id, baseSalary: staff.baseSalary, payType: staff.payType, hasFace: !!staff.faceData });
}
