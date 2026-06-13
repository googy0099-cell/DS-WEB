import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { TEST_MODE_COOKIE } from "@/lib/test-mode";

export async function GET() {
  const store = await cookies();
  return NextResponse.json({ active: store.get(TEST_MODE_COOKIE)?.value === "1" });
}

// Owner toggles test mode for their own device (cookie). Real staff are unaffected.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "เฉพาะเจ้าของร้าน" }, { status: 403 });
  }
  const { on } = (await req.json()) as { on: boolean };
  const store = await cookies();
  if (on) {
    store.set(TEST_MODE_COOKIE, "1", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 12 });
  } else {
    store.delete(TEST_MODE_COOKIE);
  }
  return NextResponse.json({ active: !!on });
}
