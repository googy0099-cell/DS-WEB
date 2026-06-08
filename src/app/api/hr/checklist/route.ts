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
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const type = req.nextUrl.searchParams.get("type") as "OPEN" | "CLOSE" | null;
    if (!type || !["OPEN", "CLOSE"].includes(type))
      return NextResponse.json({ error: "type ต้องเป็น OPEN หรือ CLOSE" }, { status: 400 });

    const today = todayBKK();
    const tomorrow = new Date(today.getTime() + 86400_000);

    const userId = Number(session.user.id);
    let hrStaff = await db.hrStaff.findUnique({ where: { userId } });
    if (!hrStaff) hrStaff = await db.hrStaff.findFirst();

    // Fetch config — gracefully skip if table doesn't exist yet
    let config: { timeLimitMinutes: number | null; deductionAmount: number } | null = null;
    try {
      config = await db.hrChecklistConfig.findUnique({ where: { type } });
    } catch {
      // migration not yet applied — no time limit
    }

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
      if (!hrStaff) return NextResponse.json({ error: "ยังไม่มีข้อมูลพนักงานในระบบ HR" }, { status: 404 });

      const templates = await db.hrChecklistTemplate.findMany({
        where: { type, isActive: true },
        orderBy: { order: "asc" },
      });

      if (templates.length === 0)
        return NextResponse.json({ error: "ยังไม่มีรายการเช็คลิสต์ในระบบ" }, { status: 404 });

      existing = await db.hrChecklist.create({
        data: {
          type,
          date: today,
          staffId: hrStaff.id,
          startedAt: new Date(),
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

    // Check time limit expiry for OPEN checklist — auto-create deduction if needed
    try {
      if (
        type === "OPEN" &&
        config?.timeLimitMinutes &&
        config.deductionAmount > 0 &&
        !existing.deductionApplied
      ) {
        const elapsed = (Date.now() - new Date(existing.startedAt ?? existing.createdAt).getTime()) / 60_000;
        const allDone = existing.items.every((i) => i.done);
        if (elapsed > config.timeLimitMinutes && !allDone) {
          const bkkNow = new Date(Date.now() + 7 * 3600_000);
          await db.hrDeduction.create({
            data: {
              staffId: existing.staffId,
              amount: config.deductionAmount,
              reason: "เช็คลิสต์เปิดร้านไม่เสร็จภายในเวลาที่กำหนด",
              month: bkkNow.getUTCMonth() + 1,
              year: bkkNow.getUTCFullYear(),
              sourceType: "CHECKLIST",
              sourceId: String(existing.id),
            },
          });
          await db.hrChecklist.update({
            where: { id: existing.id },
            data: { deductionApplied: true },
          });
          existing.deductionApplied = true;
        }
      }
    } catch {
      // deduction logic failed — don't block the checklist response
    }

    return NextResponse.json({
      ...existing,
      timeLimitMinutes: config?.timeLimitMinutes ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}

// GET /api/hr/checklist/today-status — exported via separate route
