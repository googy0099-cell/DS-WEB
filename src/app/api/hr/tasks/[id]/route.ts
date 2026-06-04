import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { status?: string; title?: string; description?: string; deadline?: string | null };

  const task = await db.hrTask.update({
    where: { id: Number(id) },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.title && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...("deadline" in body && { deadline: body.deadline ? new Date(body.deadline) : null }),
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!["MANAGER", "OWNER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await db.hrTask.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
