import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { getMonthlySummary } from "@/lib/hr-payroll";

function calcGross(payType: string, rate: number, summary: { daysWorked: number; workMinutes: number }): number {
  if (payType === "DAILY") return rate * summary.daysWorked;
  if (payType === "HOURLY") return Math.round(rate * summary.workMinutes / 60);
  return rate; // MONTHLY
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const now = new Date();
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const year = Number(url.searchParams.get("year") ?? bkk.getUTCFullYear());
  const month = Number(url.searchParams.get("month") ?? bkk.getUTCMonth() + 1);

  try {
    const staff = await db.hrStaff.findMany({
      include: {
        user: { select: { firstName: true, lastName: true } },
        deductions: { where: { year, month }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "asc" },
    });

    const result = await Promise.all(
      staff.map(async (s) => {
        const summary = await getMonthlySummary(s.id, year, month);
        const gross = calcGross(s.payType, s.baseSalary, summary);
        const totalDeductions = s.deductions.reduce((sum, d) => sum + d.amount, 0);
        return {
          id: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`.trim(),
          payType: s.payType,
          payRate: s.baseSalary,
          gross,
          summary,
          deductions: s.deductions.map((d) => ({ id: d.id, amount: d.amount, reason: d.reason, note: d.note, createdAt: d.createdAt })),
          totalDeductions,
          netPay: gross - totalDeductions,
        };
      })
    );

    return NextResponse.json({ year, month, staff: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
