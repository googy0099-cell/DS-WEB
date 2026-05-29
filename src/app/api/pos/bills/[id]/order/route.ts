import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generatePromptPayQR } from "@/lib/promptpay";

type LineItem = {
  menuItemId: number;
  nameTh: string;
  unitPriceTHB: number;
  qty: number;
  selectedSize?: string;
  selectedAddons?: string;
  selectedOptions?: string;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const billId = Number(id);
  const { paymentMethod, items, receivedAmount } = (await req.json()) as {
    paymentMethod: "CASH" | "PROMPTPAY";
    items: LineItem[];
    receivedAmount?: number;
  };

  const bill = await db.bill.findUnique({ where: { id: billId }, include: { table: true } });
  if (!bill || bill.status !== "ACTIVE") {
    return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });
  }

  const validItems = items.filter((i) => i.menuItemId && i.qty > 0);
  const totalTHB = validItems.reduce((s, i) => s + i.unitPriceTHB * i.qty, 0);

  // Cash payments confirmed immediately (cashier is physically present)
  const orderStatus = paymentMethod === "CASH" ? "SERVED" : "PENDING";

  const order = await db.order.create({
    data: {
      orderName: `บิล ${bill.name} — โต๊ะ ${bill.table.number}`,
      tableId: bill.tableId,
      status: orderStatus,
      totalTHB,
      items: {
        create: validItems.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.qty,
          unitPriceTHB: i.unitPriceTHB,
          selectedSize: i.selectedSize ?? null,
          selectedAddons: i.selectedAddons ?? null,
          selectedOptions: i.selectedOptions ?? null,
        })),
      },
    },
  });

  if (paymentMethod === "CASH") {
    const received = receivedAmount ?? totalTHB;
    const change = Math.max(0, received - totalTHB);
    await db.payment.create({
      data: {
        orderId: order.id,
        method: "CASH",
        amountTHB: totalTHB,
        status: "CONFIRMED",
        confirmedAt: new Date(),
        receivedAmount: received,
        changeAmount: change,
      },
    });
  }

  const config = await db.paymentConfig.findUnique({ where: { id: 1 } });
  const promptPayId = config?.promptPayId ?? process.env.PROMPTPAY_ID ?? "";
  const qrDataUrl =
    paymentMethod === "PROMPTPAY" && totalTHB > 0 && promptPayId
      ? await generatePromptPayQR(totalTHB, promptPayId)
      : null;

  return NextResponse.json({
    orderId: order.id,
    totalTHB,
    qrDataUrl,
    accountName: config?.accountName ?? "",
    bankName: config?.bankName ?? "",
  });
}
