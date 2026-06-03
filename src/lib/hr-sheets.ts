import { google } from "googleapis";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) return null;
  const jwt = new google.auth.JWT();
  jwt.email = email;
  jwt.key = key;
  jwt.scopes = ["https://www.googleapis.com/auth/spreadsheets"];
  return jwt;
}

function bkkDate(d: Date) {
  const bkk = new Date(d.getTime() + 7 * 3600_000);
  return bkk.toISOString().slice(0, 10);
}

function bkkTime(d: Date) {
  const bkk = new Date(d.getTime() + 7 * 3600_000);
  return bkk.toISOString().slice(11, 16);
}

function duration(checkIn: Date, checkOut: Date | null) {
  if (!checkOut) return "-";
  const mins = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}ชม. ${m}น.`;
}

export type AttendanceRow = {
  staffName: string;
  checkIn: Date;
  checkOut: Date | null;
};

export async function syncAttendanceToSheets(
  rows: AttendanceRow[],
  dateLabel: string
): Promise<{ ok: boolean; error?: string }> {
  const auth = getAuth();
  const sheetId = process.env.GOOGLE_HR_SHEET_ID;
  if (!auth || !sheetId) return { ok: false, error: "ยังไม่ได้ตั้งค่า Google Sheets" };

  try {
    const sheets = google.sheets({ version: "v4", auth });

    // Ensure sheet tab exists for this date
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const tabName = `เข้างาน ${dateLabel}`;
    const exists = meta.data.sheets?.some((s) => s.properties?.title === tabName);

    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: tabName } } }],
        },
      });
    }

    // Clear + write
    const values: string[][] = [
      ["ชื่อ", "เข้า", "ออก", "ชั่วโมง", "วันที่"],
      ...rows.map((r) => [
        r.staffName,
        bkkTime(r.checkIn),
        r.checkOut ? bkkTime(r.checkOut) : "-",
        duration(r.checkIn, r.checkOut),
        bkkDate(r.checkIn),
      ]),
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values },
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
