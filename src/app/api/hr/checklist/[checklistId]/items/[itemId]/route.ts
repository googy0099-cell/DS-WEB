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

  const item = await db.hrChecklistItem.update({
    where: { id: Number(itemId), checklistId: Number(checklistId) },
    data: {
      done,
      doneAt: done ? new Date() : null,
      photoUrl: photoBase64 ?? undefined,
    },
  });

  return NextResponse.json(item);
}
