/**
 * Logic tính công — hàm thuần, không truy cập DB.
 * Quy ước: giờ ca lưu dạng phút kể từ 00:00 giờ VN; endMinute <= startMinute nghĩa là ca qua đêm.
 */
import { addDaysToKey, localDateKey, localMinuteToInstant, minuteOfDay } from "@/lib/time";

export type ShiftRule = {
  startMinute: number;
  endMinute: number;
  breakStartMinute?: number | null;
  breakEndMinute?: number | null;
  lateGraceMinutes: number;
  earlyGraceMinutes: number;
};

export type AttendanceResult = {
  status: "PRESENT" | "LATE" | "EARLY_LEAVE" | "LATE_AND_EARLY" | "MISSING_CHECKOUT";
  lateMinutes: number;
  earlyMinutes: number;
  workedMinutes: number;
};

export function isOvernight(shift: Pick<ShiftRule, "startMinute" | "endMinute">): boolean {
  return shift.endMinute <= shift.startMinute;
}

/**
 * Xác định ngày công cho một lần chấm công.
 * Với ca qua đêm, các lần chấm trước 12:00 trưa thuộc về ca bắt đầu từ hôm trước.
 */
export function resolveWorkDate(at: Date, shift: Pick<ShiftRule, "startMinute" | "endMinute"> | null): string {
  const key = localDateKey(at);
  if (shift && isOvernight(shift) && minuteOfDay(at) < 12 * 60) {
    return addDaysToKey(key, -1);
  }
  return key;
}

/** Thời điểm bắt đầu và kết thúc ca (UTC) cho một ngày công. */
export function shiftWindow(workDate: string, shift: ShiftRule): { start: Date; end: Date } {
  const start = localMinuteToInstant(workDate, shift.startMinute);
  const endKey = isOvernight(shift) ? addDaysToKey(workDate, 1) : workDate;
  const end = localMinuteToInstant(endKey, shift.endMinute);
  return { start, end };
}

function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, Math.floor((end - start) / 60000));
}

export function computeAttendance(input: {
  workDate: string;
  shift: ShiftRule;
  checkInAt: Date;
  checkOutAt: Date | null;
}): AttendanceResult {
  const { workDate, shift, checkInAt, checkOutAt } = input;
  const { start, end } = shiftWindow(workDate, shift);

  // Trễ quá số phút cho phép thì tính toàn bộ số phút trễ.
  const rawLate = Math.floor((checkInAt.getTime() - start.getTime()) / 60000);
  const lateMinutes = rawLate > shift.lateGraceMinutes ? rawLate : 0;

  if (!checkOutAt) {
    return { status: "MISSING_CHECKOUT", lateMinutes, earlyMinutes: 0, workedMinutes: 0 };
  }

  const rawEarly = Math.floor((end.getTime() - checkOutAt.getTime()) / 60000);
  const earlyMinutes = rawEarly > shift.earlyGraceMinutes ? rawEarly : 0;

  // Giờ làm thực tế: phần giao giữa [vào, ra] và [đầu ca, cuối ca], trừ nghỉ giữa ca.
  let workedMinutes = overlapMinutes(checkInAt, checkOutAt, start, end);
  if (shift.breakStartMinute != null && shift.breakEndMinute != null) {
    const breakKey =
      isOvernight(shift) && shift.breakStartMinute < shift.startMinute ? addDaysToKey(workDate, 1) : workDate;
    const bStart = localMinuteToInstant(breakKey, shift.breakStartMinute);
    const bEnd = localMinuteToInstant(breakKey, shift.breakEndMinute);
    workedMinutes -= overlapMinutes(checkInAt, checkOutAt, bStart, bEnd);
  }

  const status: AttendanceResult["status"] =
    lateMinutes > 0 && earlyMinutes > 0
      ? "LATE_AND_EARLY"
      : lateMinutes > 0
        ? "LATE"
        : earlyMinutes > 0
          ? "EARLY_LEAVE"
          : "PRESENT";

  return { status, lateMinutes, earlyMinutes, workedMinutes: Math.max(0, workedMinutes) };
}
