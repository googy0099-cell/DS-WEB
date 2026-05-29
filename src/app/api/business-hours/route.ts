import { NextResponse } from "next/server";
import db from "@/lib/db";

export const revalidate = 60;

export async function GET() {
  const row = await db.siteSetting.findUnique({ where: { key: "business_hours" } });
  if (!row) return NextResponse.json(null);
  try {
    return NextResponse.json(JSON.parse(row.value));
  } catch {
    return NextResponse.json(null);
  }
}
