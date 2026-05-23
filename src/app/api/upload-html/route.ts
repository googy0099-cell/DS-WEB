import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });

  const isHtml = file.type === "text/html" || file.name.endsWith(".html");
  if (!isHtml) return NextResponse.json({ error: "รองรับเฉพาะไฟล์ .html" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 10MB" }, { status: 400 });

  const filename = `mini-games/${randomUUID()}.html`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filename, file, { access: "public", contentType: "text/html" });
    return NextResponse.json({ url: blob.url });
  }

  // Local fallback
  const { writeFile, mkdir } = await import("fs/promises");
  const path = await import("path");
  const dir = path.join(process.cwd(), "public", "mini-games");
  await mkdir(dir, { recursive: true });
  const localName = filename.replace("mini-games/", "");
  await writeFile(path.join(dir, localName), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/mini-games/${localName}` });
}
