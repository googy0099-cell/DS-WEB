import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const tables = await db.table.findMany({ orderBy: { number: "asc" } });
  return NextResponse.json(tables);
}
