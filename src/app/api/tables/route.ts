import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

function generateSlug(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let slug = "";
  for (let i = 0; i < 8; i++) slug += chars[Math.floor(Math.random() * chars.length)];
  return slug;
}

export async function GET() {
  const tables = await db.table.findMany({ orderBy: { number: "asc" } });
  return NextResponse.json(tables);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { number } = await req.json() as { number: number };
  if (!number || typeof number !== "number") {
    return NextResponse.json({ error: "number required" }, { status: 400 });
  }

  let slug = generateSlug();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.table.findUnique({ where: { slug } });
    if (!existing) break;
    slug = generateSlug();
    attempts++;
  }

  const table = await db.table.create({ data: { number, slug } });
  return NextResponse.json(table, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["CASHIER", "STAFF", "OWNER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, regenerateSlug } = await req.json() as { id: number; regenerateSlug?: boolean };

  if (regenerateSlug) {
    let slug = generateSlug();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.table.findUnique({ where: { slug } });
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }
    const table = await db.table.update({ where: { id }, data: { slug } });
    return NextResponse.json(table);
  }

  return NextResponse.json({ error: "nothing to update" }, { status: 400 });
}
