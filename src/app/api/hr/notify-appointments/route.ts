import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { sendTelegramNotify } from "@/lib/telegram-notify";
import { sendPushToAll } from "@/lib/push-notify";

const BKK = 7 * 3600_000;
const MONTHS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function bkkDateStr(d: Date) {
  const bkk = new Date(d.getTime() + BKK);
  return `${bkk.getUTCDate()} ${MONTHS_TH[bkk.getUTCMonth()]} ${bkk.getUTCFullYear() + 543}`;
}

// Called daily by Railway cron or external scheduler
// Protected by CRON_SECRET env var
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const now = new Date(Date.now() + BKK);
    const todayStr = now.toISOString().slice(0, 10);

    // Find all events with notify_days_before set
    const events = await db.hrPaymentEvent.findMany({
      where: { notifyDaysBefore: { not: null } },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    const notified: number[] = [];

    for (const ev of events) {
      const days = ev.notifyDaysBefore!;

      // For recurring events: project to current month
      let targetDate: Date;
      if (ev.recurrence === "MONTHLY") {
        const day = Math.min(
          new Date(ev.date.getTime() + BKK).getUTCDate(),
          new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getDate()
        );
        targetDate = new Date(`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+07:00`);
      } else {
        targetDate = ev.date;
      }

      const targetStr = new Date(targetDate.getTime() + BKK).toISOString().slice(0, 10);
      const diffMs = targetDate.getTime() - new Date(`${todayStr}T00:00:00+07:00`).getTime();
      const diffDays = Math.round(diffMs / (24 * 3600_000));

      if (diffDays !== days) continue; // Not today's notification window

      const staffName = ev.staff ? `${ev.staff.user.firstName} ${ev.staff.user.lastName}`.trim() : null;
      const daysLabel = days === 0 ? "วันนี้!" : days === 1 ? "พรุ่งนี้" : `อีก ${days} วัน`;
      const staffLine = staffName ? `\n👤 ${staffName}` : "";
      const amountLine = ev.amount > 0 ? `\n💰 ฿${ev.amount.toLocaleString("th-TH")}` : "";
      const recurrLine = ev.recurrence === "MONTHLY" ? "\n🔄 รายเดือน" : "";

      const msg =
        `📌 <b>แจ้งเตือนนัดหมาย</b> — ${daysLabel}\n` +
        `📅 ${bkkDateStr(targetDate)}\n` +
        `📋 ${ev.description}` +
        staffLine + amountLine + recurrLine;

      const pushTitle = `📌 ${ev.description}`;
      const pushBody = `${daysLabel} · ${bkkDateStr(targetDate)}${staffName ? ` · ${staffName}` : ""}`;

      await Promise.all([
        sendTelegramNotify(msg),
        sendPushToAll(pushTitle, pushBody),
      ]);
      notified.push(ev.id);
    }

    return NextResponse.json({ ok: true, notified: notified.length, ids: notified });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
