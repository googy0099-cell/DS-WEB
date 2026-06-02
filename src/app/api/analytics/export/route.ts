import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchSalesRows, fetchMenuRows, fetchGametimeRows, fetchPartiesRows, fetchReceiptsRows, buildCsv } from "@/lib/analytics-export";

const SHEET_FETCHERS = {
  sales: fetchSalesRows,
  menu: fetchMenuRows,
  gametime: fetchGametimeRows,
  parties: fetchPartiesRows,
  receipts: fetchReceiptsRows,
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["OWNER", "CASHIER", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const from = searchParams.get("from") || today;
  const to = searchParams.get("to") || today;
  const sheet = (searchParams.get("sheet") || "sales") as keyof typeof SHEET_FETCHERS;

  const fetcher = SHEET_FETCHERS[sheet];
  if (!fetcher) return NextResponse.json({ error: "Invalid sheet" }, { status: 400 });

  const { header, rows, sheetName } = await fetcher(from, to);
  const csv = "﻿" + buildCsv([header, ...rows]);
  const filename = `${sheetName}_${from}_to_${to}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
