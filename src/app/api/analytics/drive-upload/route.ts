import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  fetchSalesRows, fetchMenuRows, fetchGametimeRows, fetchPartiesRows, fetchReceiptsRows,
  uploadToGoogleSheets,
} from "@/lib/analytics-export";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.role || !["OWNER", "CASHIER", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) return NextResponse.json({ error: "GOOGLE_DRIVE_FOLDER_ID not configured" }, { status: 500 });
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return NextResponse.json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON not configured" }, { status: 500 });

  const { from, to } = (await req.json()) as { from: string; to: string };
  if (!from || !to) return NextResponse.json({ error: "from/to required" }, { status: 400 });

  try {
    const [sales, menu, gametime, parties, receipts] = await Promise.all([
      fetchSalesRows(from, to),
      fetchMenuRows(from, to),
      fetchGametimeRows(from, to),
      fetchPartiesRows(from, to),
      fetchReceiptsRows(from, to),
    ]);

    const title = `Dice Shop — รายงาน ${from} ถึง ${to}`;
    const url = await uploadToGoogleSheets(title, [sales, menu, gametime, parties, receipts], folderId);

    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[drive-upload]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
