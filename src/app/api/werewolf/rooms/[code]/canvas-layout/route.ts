import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveRoomCanvasLayout } from "@/lib/firebase-rtdb";

async function requireStaff() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!(await requireStaff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // Strip canvas drawing (data URL — too large for RTDB) before persisting
  const { canvasData: _omit, favoriteRoles: _fav, timerSeconds: _t, ...layout } = body;
  await saveRoomCanvasLayout(code, layout);
  return NextResponse.json({ ok: true });
}
