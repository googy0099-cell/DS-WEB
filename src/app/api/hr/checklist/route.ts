import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

const BKK = 7 * 3600_000;

function todayBKK() {
  const now = new Date(Date.now() + BKK);
  const s = now.toISOString().slice(0, 10);
  return new Date(`${s}T00:00:00+07:00`);
}

// GET /api/hr/checklist?type=OPEN|CLOSE
// Returns (or creates) today's shared checklist for the given type.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type") as "OPEN" | "CLOSE" | null;
  if (!type || !["OPEN", "CLOSE"].includes(type))
    return NextResponse.json({ error: "type ต้องเป็น OPEN หรือ CLOSE" }, { status: 400 });

  const today = todayBKK();
  const tomorrow = new Date(today.getTime() + 86400_000);

  const userId = Number(session.user.id);
  const hrStaff = await db.hrStaff.findUnique({ where: { userId } });
  if (!hrStaff) return NextResponse.json({ error: "ไม่พบข้อมูลพนักงาน HR" }, { status: 404 });

  // Find today's shared checklist (any staff)
  let existing = await db.hrChecklist.findFirst({
    where: { type, date: { gte: today, lt: tomorrow } },
    include: { items: { orderBy: { id: "asc" }, include: { doneByStaff: { include: { user: { select: { firstName: true } } } } } } },
  });

  // If existing checklist was built from old hardcoded template (no templateId), rebuild from DB
  const isOldFormat = existing && existing.items.every((i) => i.templateId === null);
  if (isOldFormat && existing) {
    await db.hrChecklistItem.deleteMany({ where: { checklistId: existing.id } });
    await db.hrChecklist.delete({ where: { id: existing.id } });
    existing = null;
  }

  if (!existing) {
    const templates = await db.hrChecklistTemplate.findMany({
      where: { type, isActive: true },
      orderBy: { order: "asc" },
    });

    existing = await db.hrChecklist.create({
      data: {
        type,
        date: today,
        staffId: hrStaff.id,
        items: {
          create: templates.map((t) => ({
            templateId: t.id,
            label: t.label,
            section: t.section,
            requiresPhoto: t.requiresPhoto,
          })),
        },
      },
      include: { items: { orderBy: { id: "asc" }, include: { doneByStaff: { include: { user: { select: { firstName: true } } } } } } },
    });
  }

  return NextResponse.json(existing);
}

// GET /api/hr/checklist/today-status — exported via separate route
