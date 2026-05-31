import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

async function requireStaff() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "OWNER")) return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "อ่านข้อมูลไม่ได้" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const key = formData.get("key") as string | null; // "alert_sound_url" or "kitchen_sound_url"

  if (!file || !key) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  if (key !== "alert_sound_url" && key !== "kitchen_sound_url")
    return NextResponse.json({ error: "key ไม่ถูกต้อง" }, { status: 400 });
  if (!file.type.startsWith("audio/")) return NextResponse.json({ error: "รองรับเฉพาะไฟล์เสียง" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 20MB" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "wav";
  const filename = `alert-sounds/${randomUUID()}.${ext}`;

  let url: string;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, file, { access: "public" });
      url = blob.url;
    } catch (e) {
      return NextResponse.json({ error: `อัปโหลดไม่ได้: ${String(e)}` }, { status: 500 });
    }
  } else {
    try {
      const { writeFile, mkdir } = await import("fs/promises");
      const path = await import("path");
      const dir = path.join(process.cwd(), "public", "alert-sounds");
      await mkdir(dir, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      const localName = `${randomUUID()}.${ext}`;
      await writeFile(path.join(dir, localName), buffer);
      url = `/alert-sounds/${localName}`;
    } catch (e) {
      return NextResponse.json({ error: `บันทึกไฟล์ไม่ได้: ${String(e)}` }, { status: 500 });
    }
  }

  await db.siteSetting.upsert({
    where: { key },
    create: { key, value: url },
    update: { value: url },
  });

  return NextResponse.json({ url });
}
