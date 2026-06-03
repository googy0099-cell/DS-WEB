import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { CHECKLIST_TEMPLATES } from "@/lib/hr-checklist-template";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type") as "OPEN" | "CLOSE" | null;
  if (!type || !["OPEN", "CLOSE"].includes(type)) {
    return NextResponse.json({ error: "type ต้องเป็น OPEN หรือ CLOSE" }, { status: 400 });
  }

  const userId = Number(session.user.id);
  const hrStaff = await db.hrStaff.findUnique({ where: { userId } });
  if (!hrStaff) return NextResponse.json({ error: "ไม่พบข้อมูลพนักงาน HR" }, { status: 404 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let checklist = await db.hrChecklist.findFirst({
    where: { staffId: hrStaff.id, type, date: { gte: today, lt: tomorrow } },
    include: { items: { orderBy: { id: "asc" } } },
  });

  if (!checklist) {
    const template = CHECKLIST_TEMPLATES[type];
    checklist = await db.hrChecklist.create({
      data: {
        type,
        date: today,
        staffId: hrStaff.id,
        items: { create: template.map((t) => ({ label: t.label })) },
      },
      include: { items: { orderBy: { id: "asc" } } },
    });
  }

  const template = CHECKLIST_TEMPLATES[type];
  return NextResponse.json({
    ...checklist,
    items: checklist.items.map((item) => ({
      ...item,
      requiresPhoto: template.find((t) => t.label === item.label)?.requiresPhoto ?? false,
    })),
  });
}
