import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

const ALLOWED_KEYS = ["promo_title", "promo_body", "promo_enabled", "print_receipt", "print_kitchen", "menu_categories", "business_hours"] as const;
type SettingKey = (typeof ALLOWED_KEYS)[number];

async function requireStaff() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

export async function GET() {
  const rows = await db.siteSetting.findMany({ where: { key: { in: [...ALLOWED_KEYS] } } });
  const data: Record<string, string> = {};
  for (const r of rows) data[r.key] = r.value;
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<Record<SettingKey, string>>;

  await Promise.all(
    ALLOWED_KEYS.filter((k) => body[k] !== undefined).map((k) =>
      db.siteSetting.upsert({
        where: { key: k },
        create: { key: k, value: body[k]! },
        update: { value: body[k]! },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
