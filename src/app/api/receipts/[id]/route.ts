import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { buildReceiptHtml, type ReceiptHtmlSettings } from "@/lib/receipt-html";
import { formatThaiDateTime } from "@/lib/thai-datetime";

const DEFAULT_SETTINGS: ReceiptHtmlSettings = {
  shopName: "ร้านลูกเต๋า", shopInfo: "The Dice Shop", paperWidth: "80",
  footer: "ขอบคุณที่ใช้บริการ 🎲",
  showOrderId: true, showDate: true, showCustomer: true,
  showNote: true, showItemPrice: true, showTotal: true,
  titleSize: "double", feedLines: 3, headerAlign: "center", htmlFontSize: 13, logoSize: 80,
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;
  if (role !== "OWNER" && role !== "CASHIER" && role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const [receipt, settingRow] = await Promise.all([
    db.receipt.findUnique({ where: { id: parseInt(id) } }),
    db.siteSetting.findUnique({ where: { key: "print_receipt" } }),
  ]);
  if (!receipt) return NextResponse.json({ error: "ไม่พบใบเสร็จ" }, { status: 404 });

  let settings: ReceiptHtmlSettings = DEFAULT_SETTINGS;
  if (settingRow?.value) {
    try { settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingRow.value) }; } catch {}
  }

  type StoredItem = {
    menuItem: { nameTh: string };
    quantity: number;
    unitPriceTHB: number;
    selectedSize?: string | null;
    selectedAddons?: string | null;
    selectedOptions?: string | null;
  };
  const stored: StoredItem[] = JSON.parse(receipt.itemsJson);

  const receiptNumber = `RC-${receipt.confirmedAt.toISOString().slice(0, 10).replace(/-/g, "")}-${String(receipt.id).padStart(5, "0")}`;

  const html = buildReceiptHtml(
    {
      orderId: receipt.orderId,
      orderName: receipt.orderName,
      totalTHB: receipt.totalTHB,
      discountAmount: receipt.discountAmount ?? undefined,
      dateStr: formatThaiDateTime(receipt.confirmedAt),
      items: stored.map((i) => ({ ...i, nameTh: i.menuItem.nameTh })),
      receiptNumber,
      locationLabel: receipt.locationLabel ?? undefined,
      paymentMethod: receipt.paymentMethod ?? undefined,
      showPrintButton: true,
    },
    settings
  );

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
