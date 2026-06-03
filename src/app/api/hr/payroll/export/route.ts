import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { getMonthlySummary } from "@/lib/hr-payroll";

function calcGross(payType: string, rate: number, summary: { daysWorked: number; workMinutes: number }): number {
  if (payType === "DAILY") return rate * summary.daysWorked;
  if (payType === "HOURLY") return Math.round(rate * summary.workMinutes / 60);
  return rate;
}

const MONTH_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export async function GET(req: NextRequest) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const bkk = new Date(Date.now() + 7 * 3600_000);
  const year = Number(url.searchParams.get("year") ?? bkk.getUTCFullYear());
  const month = Number(url.searchParams.get("month") ?? bkk.getUTCMonth() + 1);

  try {
    const staff = await db.hrStaff.findMany({
      include: {
        user: { select: { firstName: true, lastName: true } },
        deductions: { where: { year, month } },
      },
      orderBy: { createdAt: "asc" },
    });

    const rows = await Promise.all(staff.map(async (s) => {
      const summary = await getMonthlySummary(s.id, year, month);
      const gross = calcGross(s.payType, s.baseSalary, summary);
      const deductions = s.deductions.reduce((sum, d) => sum + d.amount, 0);
      const net = gross - deductions;
      const payTypeLabel = s.payType === "DAILY" ? "รายวัน" : s.payType === "HOURLY" ? "รายชั่วโมง" : "รายเดือน";
      return [
        `${s.user.firstName} ${s.user.lastName}`.trim(),
        payTypeLabel,
        s.baseSalary,
        summary.daysWorked,
        Math.round(summary.workMinutes / 60 * 10) / 10,
        summary.onTimeCount,
        summary.lateCount,
        gross,
        deductions,
        net,
      ];
    }));

    const headers = ["ชื่อพนักงาน", "ประเภท", "อัตรา", "วันทำงาน", "ชั่วโมงทำงาน", "ตรงเวลา", "สาย", "รายได้รวม", "หัก", "สุทธิ"];
    const monthLabel = `${MONTH_TH[month - 1]} ${year + 543}`;

    const csv = [
      `รายงานเงินเดือน เดือน${monthLabel}`,
      headers.join(","),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
    ].join("\n");

    const filename = `payroll-${year}-${String(month).padStart(2, "0")}.csv`;
    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
