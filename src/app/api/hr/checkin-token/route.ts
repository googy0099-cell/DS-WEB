import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { auth } from "@/lib/auth";
import { signToken, distanceMeters, shopGeofence } from "@/lib/hr-checkin-token";

// Issues a rotating check-in token for the logged-in staff member.
// Gated by GPS: the phone must be within the shop's radius to get a token,
// so an absent employee can't generate a valid QR from home.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const { lat, lng } = (await req.json().catch(() => ({}))) as {
    lat?: number;
    lng?: number;
  };

  const fence = shopGeofence();
  if (fence) {
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "ต้องอนุญาตตำแหน่งเพื่อขอ QR เช็คอิน" },
        { status: 400 }
      );
    }
    const dist = distanceMeters(lat, lng, fence.lat, fence.lng);
    if (dist > fence.radiusM) {
      return NextResponse.json(
        { error: "อยู่นอกพื้นที่ร้าน — ต้องอยู่ที่ร้านจึงจะขอ QR ได้" },
        { status: 403 }
      );
    }
  }

  const staff = await db.hrStaff.findUnique({
    where: { userId: parseInt(session.user.id, 10) },
    select: { id: true },
  });
  if (!staff) {
    return NextResponse.json(
      { error: "บัญชีนี้ไม่ได้ลงทะเบียนเป็นพนักงาน HR" },
      { status: 404 }
    );
  }

  const { token, expiresAt } = signToken(staff.id);
  return NextResponse.json({ token, expiresAt });
}
