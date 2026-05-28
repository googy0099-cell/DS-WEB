import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "กรุณา login ก่อน" }, { status: 401 });
    }
  } catch (e) {
    return NextResponse.json({ error: `ตรวจสอบสิทธิ์ไม่ได้: ${String(e)}` }, { status: 500 });
  }

  let file: File | null = null;
  try {
    const formData = await req.formData();
    file = formData.get("file") as File | null;
  } catch (e) {
    return NextResponse.json({ error: `อ่านไฟล์ไม่ได้: ${String(e)}` }, { status: 400 });
  }

  if (!file) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "รองรับเฉพาะไฟล์รูปภาพ" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 5MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `uploads/${randomUUID()}.${ext}`;

  // Vercel Blob (production)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, file, { access: "public" });
      return NextResponse.json({ url: blob.url });
    } catch (e) {
      return NextResponse.json({ error: `Blob upload ล้มเหลว: ${String(e)}` }, { status: 500 });
    }
  }

  // Local filesystem fallback (development)
  try {
    const { writeFile, mkdir } = await import("fs/promises");
    const path = await import("path");
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    const localName = filename.replace("uploads/", "");
    await writeFile(path.join(uploadsDir, localName), buffer);
    return NextResponse.json({ url: `/uploads/${localName}` });
  } catch (e) {
    return NextResponse.json({ error: `บันทึกไฟล์ไม่ได้: ${String(e)}` }, { status: 500 });
  }
}
