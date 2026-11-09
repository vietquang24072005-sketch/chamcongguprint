/**
 * Quy tắc nghiệp vụ cho đơn từ — hàm thuần, không truy cập DB.
 */
import { addDaysToKey, dateKeyToDb } from "@/lib/time";

export type RequestTypeValue =
  | "ANNUAL_LEAVE"
  | "UNPAID_LEAVE"
  | "MISSED_CHECK"
  | "LATE_EARLY"
  | "OVERTIME"
  | "BUSINESS_TRIP";

/** Loại đơn trải dài nhiều ngày (chiếm ngày làm việc). */
export const RANGE_TYPES: RequestTypeValue[] = ["ANNUAL_LEAVE", "UNPAID_LEAVE", "BUSINESS_TRIP"];
/** Loại đơn chỉ áp dụng cho một ngày. */
export const SINGLE_DAY_TYPES: RequestTypeValue[] = ["MISSED_CHECK", "LATE_EARLY", "OVERTIME"];

export function isRangeType(type: RequestTypeValue): boolean {
  return RANGE_TYPES.includes(type);
}

/** Danh sách ngày trong khoảng [start, end] (bao gồm cả hai đầu). */
export function daysInRange(startKey: string, endKey: string): string[] {
  const days: string[] = [];
  for (let k = startKey; k <= endKey; k = addDaysToKey(k, 1)) days.push(k);
  return days;
}

export function weekdayOf(key: string): number {
  return dateKeyToDb(key).getUTCDay();
}

/** Các ngày làm việc trong khoảng: bỏ cuối tuần (theo cấu hình) và ngày lễ. */
export function workingDaysInRange(
  startKey: string,
  endKey: string,
  workingWeekdays: number[],
  holidays: ReadonlySet<string>,
): string[] {
  return daysInRange(startKey, endKey).filter((k) => workingWeekdays.includes(weekdayOf(k)) && !holidays.has(k));
}

/** Số ngày phép một đơn chiếm (nửa ngày = 0.5). */
export function countLeaveDays(
  input: { startKey: string; endKey: string; halfDay: boolean },
  workingWeekdays: number[],
  holidays: ReadonlySet<string>,
): number {
  const days = workingDaysInRange(input.startKey, input.endKey, workingWeekdays, holidays);
  if (days.length === 0) return 0;
  return input.halfDay ? 0.5 : days.length;
}

/** Số ngày phép đã dùng/đang chờ trong một năm (chỉ tính phần ngày thuộc năm đó). */
export function leaveDaysInYear(
  requests: { startKey: string; endKey: string; halfDay: boolean }[],
  year: number,
  workingWeekdays: number[],
  holidays: ReadonlySet<string>,
): number {
  const prefix = `${year}-`;
  return requests.reduce((sum, r) => {
    const days = workingDaysInRange(r.startKey, r.endKey, workingWeekdays, holidays).filter((k) =>
      k.startsWith(prefix),
    );
    if (days.length === 0) return sum;
    return sum + (r.halfDay ? 0.5 : days.length);
  }, 0);
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Ai được duyệt đơn của ai. Không ai được tự duyệt đơn của mình. */
export function canApprove(
  approver: { id: string; role: "EMPLOYEE" | "MANAGER" | "HR" | "ADMIN"; departmentId: string | null },
  owner: { id: string; departmentId: string | null },
): boolean {
  if (approver.id === owner.id) return false;
  if (approver.role === "HR" || approver.role === "ADMIN") return true;
  if (approver.role === "MANAGER") return approver.departmentId !== null && approver.departmentId === owner.departmentId;
  return false;
}

/** Ghép ghi chú mới vào ghi chú cũ. */
export function appendNote(existing: string | null | undefined, note: string): string {
  return existing ? `${existing}; ${note}` : note;
}
