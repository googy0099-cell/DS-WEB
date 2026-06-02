import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

const METHOD_LABELS: Record<string, string> = {
  PROMPTPAY: "QR PromptPay",
  CASH: "เงินสด",
  UNSET: "-",
};

function receiptNo(id: number, confirmedAt: Date) {
  const d = confirmedAt.toISOString().slice(0, 10).replace(/-/g, "");
  return `RC-${d}-${String(id).padStart(5, "0")}`;
}

function formatBKK(d: Date) {
  return d.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function csvEscape(v: string | number) {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (role !== "OWNER" && role !== "CASHIER" && role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const fromDate = from ? new Date(from + "T00:00:00+07:00") : undefined;
  const toDate = to ? new Date(to + "T23:59:59+07:00") : undefined;

  const receipts = await db.receipt.findMany({
    where: {
      ...(fromDate || toDate
        ? { confirmedAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
        : {}),
    },
    orderBy: { confirmedAt: "desc" },
  });

  const headers = ["เลขที่ใบเสร็จ", "วันที่ชำระ", "ออเดอร์", "สถานที่", "วิธีชำระ", "ยอด (บาท)"];
  const rows = receipts.map((r) => [
    receiptNo(r.id, r.confirmedAt),
    formatBKK(r.confirmedAt),
    r.orderName ?? "",
    r.locationLabel ?? "",
    METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod,
    r.totalTHB,
  ]);

  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\r\n");

  const filename = `receipts_${from ?? "all"}_to_${to ?? "all"}.csv`;

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
