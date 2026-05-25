import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

// GET — list all unique tags with usage count
export async function GET() {
  const games = await db.gameGuide.findMany({ select: { tags: true } });
  const tally: Record<string, number> = {};
  for (const game of games) {
    for (const tag of parseTags(game.tags)) {
      tally[tag] = (tally[tag] ?? 0) + 1;
    }
  }
  const tags = Object.entries(tally)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
  return NextResponse.json({ tags });
}

// DELETE — remove a tag from every game that uses it
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { tag } = await req.json();
  if (!tag) return NextResponse.json({ error: "ไม่ระบุประเภท" }, { status: 400 });

  const games = await db.gameGuide.findMany({ select: { id: true, tags: true } });
  let updated = 0;
  for (const game of games) {
    const tags = parseTags(game.tags);
    if (!tags.includes(tag)) continue;
    const newTags = tags.filter((t) => t !== tag);
    await db.gameGuide.update({ where: { id: game.id }, data: { tags: JSON.stringify(newTags) } });
    updated++;
  }
  return NextResponse.json({ ok: true, updated });
}

// POST — rename a tag across all games
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { oldTag, newTag } = await req.json();
  if (!oldTag || !newTag) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  const games = await db.gameGuide.findMany({ select: { id: true, tags: true } });
  let updated = 0;
  for (const game of games) {
    const tags = parseTags(game.tags);
    if (!tags.includes(oldTag)) continue;
    const newTags = tags.map((t) => (t === oldTag ? newTag : t));
    await db.gameGuide.update({ where: { id: game.id }, data: { tags: JSON.stringify(newTags) } });
    updated++;
  }
  return NextResponse.json({ ok: true, updated });
}
