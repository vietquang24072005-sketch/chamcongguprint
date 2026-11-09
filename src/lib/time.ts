import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Ho_Chi_Minh";

/** Chuyển một thời điểm sang giờ VN. */
export function toLocal(date: Date): TZDate {
  return new TZDate(date, APP_TIMEZONE);
}

/** Số phút kể từ 00:00 giờ VN của một thời điểm. */
export function minuteOfDay(date: Date): number {
  const local = toLocal(date);
  return local.getHours() * 60 + local.getMinutes();
}

/** Ngày theo giờ VN dạng yyyy-MM-dd. */
export function localDateKey(date: Date): string {
  return format(toLocal(date), "yyyy-MM-dd");
}

/** Chuyển "yyyy-MM-dd" thành Date (00:00 UTC) để lưu vào cột @db.Date. */
export function dateKeyToDb(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Đọc cột @db.Date ra "yyyy-MM-dd". */
export function dbDateToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Cộng/trừ ngày cho một dateKey. */
export function addDaysToKey(key: string, days: number): string {
  const d = dateKeyToDb(key);
  d.setUTCDate(d.getUTCDate() + days);
  return dbDateToKey(d);
}

/** Thời điểm UTC tương ứng với `minute` phút sau 00:00 giờ VN của ngày `key`. */
export function localMinuteToInstant(key: string, minute: number): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, 0, minute, 0, APP_TIMEZONE).getTime());
}

export function formatTime(date: Date | null | undefined): string {
  return date ? format(toLocal(date), "HH:mm") : "--:--";
}

export function formatDateKey(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export function minutesToHHmm(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
