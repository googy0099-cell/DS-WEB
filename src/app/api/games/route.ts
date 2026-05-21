import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const tag = searchParams.get("tag")?.trim() ?? "";
  const all = searchParams.get("all") === "1";

  const games = await db.gameGuide.findMany({
    where: {
      AND: [
        all ? {} : { isActive: true },
        q
          ? {
              OR: [
                { nameTh: { contains: q } },
                { nameEn: { contains: q } },
                { summaryTh: { contains: q } },
              ],
            }
          : {},
        tag ? { tags: { contains: tag } } : {},
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { nameTh: "asc" }],
  });

  return NextResponse.json(games);
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const data = await req.json();
  const game = await db.gameGuide.create({
    data: {
      nameTh: data.nameTh,
      nameEn: data.nameEn ?? "",
      summaryTh: data.summaryTh ?? "",
      youtubeUrl: data.youtubeUrl || null,
      imageUrl: data.imageUrl || null,
      minPlayers: Number(data.minPlayers) || 2,
      maxPlayers: Number(data.maxPlayers) || 8,
      durationMin: Number(data.durationMin) || 30,
      tags: data.tags ?? "[]",
      isActive: data.isActive ?? true,
      sortOrder: Number(data.sortOrder) || 0,
    },
  });
  return NextResponse.json(game, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { id, ...data } = await req.json();
  const game = await db.gameGuide.update({
    where: { id },
    data: {
      ...(data.nameTh !== undefined && { nameTh: data.nameTh }),
      ...(data.nameEn !== undefined && { nameEn: data.nameEn }),
      ...(data.summaryTh !== undefined && { summaryTh: data.summaryTh }),
      ...(data.youtubeUrl !== undefined && { youtubeUrl: data.youtubeUrl || null }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
      ...(data.minPlayers !== undefined && { minPlayers: Number(data.minPlayers) }),
      ...(data.maxPlayers !== undefined && { maxPlayers: Number(data.maxPlayers) }),
      ...(data.durationMin !== undefined && { durationMin: Number(data.durationMin) }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: Number(data.sortOrder) }),
    },
  });
  return NextResponse.json(game);
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  const { id } = await req.json();
  await db.gameGuide.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
