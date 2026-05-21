import { formatInTimeZone } from "date-fns-tz";
import { th } from "date-fns/locale";

const TZ = "Asia/Bangkok";

export function formatThaiDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, TZ, "d MMM yyyy HH:mm น.", { locale: th });
}

export function formatThaiTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, TZ, "HH:mm น.", { locale: th });
}

export function nowBangkok(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}
