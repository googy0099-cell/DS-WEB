import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "อ่านข้อมูลไม่ได้" }, { status: 400 });
  }

  const orderIdRaw = formData.get("orderId");
  const file = formData.get("slip") as File | null;

  if (!orderIdRaw || !file) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "รองรับเฉพาะไฟล์รูปภาพ" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 10MB" }, { status: 400 });
  }

  const orderId = Number(orderIdRaw);
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "ไม่พบออเดอร์" }, { status: 404 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `slips/${randomUUID()}.${ext}`;

  let slipUrl: string;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, file, { access: "public" });
      slipUrl = blob.url;
    } catch (e) {
      return NextResponse.json({ error: `อัปโหลดสลิปไม่ได้: ${String(e)}` }, { status: 500 });
    }
  } else {
    try {
      const { writeFile, mkdir } = await import("fs/promises");
      const path = await import("path");
      const dir = path.join(process.cwd(), "public", "slips");
      await mkdir(dir, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      const localName = `${randomUUID()}.${ext}`;
      await writeFile(path.join(dir, localName), buffer);
      slipUrl = `/slips/${localName}`;
    } catch (e) {
      return NextResponse.json({ error: `บันทึกสลิปไม่ได้: ${String(e)}` }, { status: 500 });
    }
  }

  const existing = await db.payment.findUnique({ where: { orderId } });
  if (existing) {
    // Uploading a slip means the customer chose to scan — lock method to PROMPTPAY
    await db.payment.update({ where: { orderId }, data: { slipUrl, method: "PROMPTPAY" } });
  } else {
    await db.payment.create({
      data: { orderId, method: "PROMPTPAY", amountTHB: order.totalTHB, status: "PENDING", slipUrl },
    });
  }


  return NextResponse.json({ ok: true });
}
