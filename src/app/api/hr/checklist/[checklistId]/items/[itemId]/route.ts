import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ checklistId: string; itemId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { checklistId, itemId } = await params;
  const { done, photoBase64 } = (await req.json()) as { done: boolean; photoBase64?: string };

  const userId = Number(session.user.id);
  const hrStaff = await db.hrStaff.findUnique({ where: { userId } });

  const item = await db.hrChecklistItem.update({
    where: { id: Number(itemId), checklistId: Number(checklistId) },
    data: {
      done,
      doneAt: done ? new Date() : null,
      doneBy: done ? (hrStaff?.id ?? null) : null,
      photoUrl: photoBase64 !== undefined ? (photoBase64 || null) : undefined,
    },
    include: { doneByStaff: { include: { user: { select: { firstName: true } } } } },
  });

  return NextResponse.json(item);
}
