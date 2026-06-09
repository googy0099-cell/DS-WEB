import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendPushToAll } from "@/lib/push-notify";

const BKK = 7 * 3600_000;

// Called hourly by Railway cron
// Protected by CRON_SECRET env var
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bkkNow = new Date(Date.now() + BKK);
  const hourBKK = bkkNow.getUTCHours(); // already in BKK
  const dateStr = bkkNow.toISOString().slice(0, 10);
  const todayBKK = new Date(`${dateStr}T00:00:00+07:00`);
  const tomorrowBKK = new Date(todayBKK.getTime() + 86400_000);

  const notified: string[] = [];

  // Opening checklist: remind between 10:00–15:00 if incomplete
  if (hourBKK >= 10 && hourBKK < 15) {
    const cl = await db.hrChecklist.findFirst({
      where: { type: "OPEN", date: { gte: todayBKK, lt: tomorrowBKK } },
      include: { items: { select: { done: true } } },
    });
    const done = cl ? cl.items.filter((i) => i.done).length : 0;
    const total = cl ? cl.items.length : -1;

    if (total > 0 && done < total) {
      await sendPushToAll("⚠️ เช็คลิสต์เปิดร้าน", `ยังค้างอยู่ ${total - done} รายการ`);
      notified.push("OPEN");
    }
  }

  // Closing checklist: remind between 21:00–24:00 if incomplete
  if (hourBKK >= 21) {
    const cl = await db.hrChecklist.findFirst({
      where: { type: "CLOSE", date: { gte: todayBKK, lt: tomorrowBKK } },
      include: { items: { select: { done: true } } },
    });
    const done = cl ? cl.items.filter((i) => i.done).length : 0;
    const total = cl ? cl.items.length : -1;

    if (total > 0 && done < total) {
      await sendPushToAll("🌙 เช็คลิสต์ปิดร้าน", `ยังค้างอยู่ ${total - done} รายการ`);
      notified.push("CLOSE");
    }
  }

  return NextResponse.json({ ok: true, notified });
}
