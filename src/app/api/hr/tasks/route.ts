import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const role = (session.user as { role?: string }).role;
  const hrStaff = await db.hrStaff.findUnique({ where: { userId } });

  const tasks = await db.hrTask.findMany({
    where: role === "STAFF" && hrStaff ? { assignedTo: hrStaff.id } : {},
    include: {
      assignee: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
    },
    orderBy: [{ status: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!["CASHIER", "OWNER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, description, assignedTo, deadline } = (await req.json()) as {
    title: string;
    description?: string;
    assignedTo?: number;
    deadline?: string;
  };

  if (!title?.trim()) return NextResponse.json({ error: "ต้องระบุชื่องาน" }, { status: 400 });

  const task = await db.hrTask.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      assignedTo: assignedTo ?? null,
      deadline: deadline ? new Date(deadline) : null,
    },
    include: {
      assignee: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
