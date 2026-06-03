import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const table = await db.table.findUnique({
    where: { slug },
    select: { id: true, number: true, slug: true },
  });

  if (!table) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(table);
}
