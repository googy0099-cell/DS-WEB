import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { computeDailyDeductionAmount } from "@/lib/hr-attendance";

const BKK = 7 * 3600_000;

// GET /api/hr/task-deduction — overdue tasks (deadline passed, status != DONE, has assignee)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !["OWNER", "MANAGER"].includes(session.user.role ?? ""))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const tasks = await db.hrTask.findMany({
      where: {
        status: { not: "DONE" },
        deadline: { lt: now },
        assignedTo: { not: null },
      },
      include: {
        assignee: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { deadline: "asc" },
    });

    const nowMs = Date.now() + BKK;
    const result = tasks.map((t) => {
      const daysOverdue = Math.ceil((nowMs - new Date(t.deadline!).getTime()) / 86400_000);
      return {
        taskId: t.id,
        title: t.title,
        status: t.status,
        deadline: t.deadline,
        daysOverdue,
        staffId: t.assignedTo!,
        staffName: `${t.assignee!.user.firstName} ${t.assignee!.user.lastName}`.trim(),
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// POST /api/hr/task-deduction — apply deduction for a specific overdue task
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["OWNER", "MANAGER"].includes(session.user.role ?? ""))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { taskId } = await req.json() as { taskId: number };
    if (!taskId) return NextResponse.json({ error: "ต้องระบุ taskId" }, { status: 400 });

    const task = await db.hrTask.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, baseSalary: true, payType: true } },
      },
    });
    if (!task) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
    if (!task.assignedTo || !task.assignee) return NextResponse.json({ error: "ไม่มีผู้รับผิดชอบ" }, { status: 422 });
    if (!task.deadline) return NextResponse.json({ error: "งานนี้ไม่มี deadline" }, { status: 422 });
    if (task.status === "DONE") return NextResponse.json({ error: "งานนี้เสร็จแล้ว" }, { status: 422 });

    const cfg = await db.hrLateConfig.findFirst();
    if (!cfg || cfg.taskDeductionAmount <= 0)
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่าหักงานเกินกำหนด — ไปตั้งค่าที่หน้า 'ตั้งค่า HR' ก่อน" }, { status: 422 });

    const nowMs = Date.now() + BKK;
    const daysOverdue = Math.ceil((nowMs - new Date(task.deadline).getTime()) / 86400_000);
    if (daysOverdue <= 0) return NextResponse.json({ error: "งานนี้ยังไม่เกินกำหนด" }, { status: 422 });

    // Idempotent: one deduction per task ever
    const existing = await db.hrDeduction.findUnique({
      where: { sourceType_sourceId: { sourceType: "TASK", sourceId: String(taskId) } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "งานนี้ถูกหักเงินไปแล้ว", alreadyApplied: true, amount: existing.amount },
        { status: 409 }
      );
    }

    const amount = computeDailyDeductionAmount(
      daysOverdue,
      { deductionType: cfg.taskDeductionType, deductionAmount: cfg.taskDeductionAmount },
      { baseSalary: task.assignee.baseSalary ?? 0, payType: task.assignee.payType ?? "MONTHLY" }
    );

    // Deduction is booked to the BKK month the overdue penalty is applied in.
    const bkkNow = new Date(Date.now() + BKK);
    const typeLabel = cfg.taskDeductionType === "PERCENT" ? ` (${cfg.taskDeductionAmount}%/วัน)` : "";
    await db.hrDeduction.create({
      data: {
        staffId: task.assignedTo,
        amount,
        reason: `งานเกินกำหนด: ${task.title} (${daysOverdue} วัน)${typeLabel}`,
        month: bkkNow.getUTCMonth() + 1,
        year: bkkNow.getUTCFullYear(),
        sourceType: "TASK",
        sourceId: String(taskId),
      },
    });

    return NextResponse.json({ applied: true, amount, daysOverdue });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
