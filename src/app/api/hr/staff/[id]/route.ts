import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

// Save face descriptor for a staff member (OWNER/CASHIER only)
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
  const { faceData } = (await req.json()) as { faceData: string };

  const staff = await db.hrStaff.update({
    where: { id: Number(id) },
    data: { faceData },
  });

  return NextResponse.json({ id: staff.id, hasFace: !!staff.faceData });
}
