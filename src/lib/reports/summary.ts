/**
 * Tổng hợp bảng công tháng cho một nhân viên — hàm thuần, không truy cập DB.
 *
 * Quy ước ký hiệu (dùng cả trên web và Excel):
 *   X  đủ công        M  đi muộn        S  về sớm        MS  muộn & sớm
 *   Q  quên check-out  P  phép năm       KL nghỉ không lương
 *   P/2, KL/2 nghỉ nửa ngày             CT công tác
 *   V  vắng mặt        V/2 vắng nửa ngày  L  ngày lễ        -  ngày nghỉ tuần
 *   (trống) chưa tới ngày / chưa vào làm
 */
import { daysInRange, weekdayOf } from "@/lib/requests/rules";

export type DayCode =
  | "X"
  | "M"
  | "S"
  | "MS"
  | "Q"
  | "P"
  | "P/2"
  | "KL"
  | "KL/2"
  | "CT"
  | "V"
  | "V/2"
  | "L"
  | "-"
  | "";

export const DAY_CODE_LABEL: Record<Exclude<DayCode, "">, string> = {
  X: "Đủ công",
  M: "Đi muộn",
  S: "Về sớm",
  MS: "Muộn & về sớm",
  Q: "Quên check-out",
  P: "Nghỉ phép năm",
  "P/2": "Nghỉ phép nửa ngày",
  KL: "Nghỉ không lương",
  "KL/2": "Không lương nửa ngày",
  CT: "Công tác",
  V: "Vắng mặt",
  "V/2": "Vắng nửa ngày",
  L: "Ngày lễ",
  "-": "Ngày nghỉ tuần",
};

export type DayRecord = {
  workDate: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  status: string;
  lateMinutes: number;
  earlyMinutes: number;
  workedMinutes: number;
};

export type ApprovedRequest = {
  type: "ANNUAL_LEAVE" | "UNPAID_LEAVE" | "MISSED_CHECK" | "LATE_EARLY" | "OVERTIME" | "BUSINESS_TRIP";
  startKey: string;
  endKey: string;
  halfDay: boolean;
  requestedCheckIn: Date | null;
  requestedCheckOut: Date | null;
};

export type DayCell = {
  date: string;
  code: DayCode;
  isWorkingDay: boolean;
  holidayName?: string;
  record?: DayRecord;
};

export type MonthlySummary = {
  /** Số ngày công chuẩn trong tháng (ngày làm việc, trừ lễ, từ ngày vào làm). */
  standardDays: number;
  presentDays: number;
  businessTripDays: number;
  annualLeaveDays: number;
  unpaidLeaveDays: number;
  paidHolidays: number;
  absentDays: number;
  lateCount: number;
  lateMinutes: number;
  earlyCount: number;
  earlyMinutes: number;
  missingCheckout: number;
  workedMinutes: number;
  overtimeMinutes: number;
  /** Công tính lương = có mặt + công tác + phép năm + lễ. */
  paidDays: number;
  days: DayCell[];
};

export function monthRange(monthKey: string): { start: string; end: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${monthKey}-01`, end: `${monthKey}-${String(last).padStart(2, "0")}` };
}

function covers(r: ApprovedRequest, day: string) {
  return r.startKey <= day && day <= r.endKey;
}

export function buildMonthlySummary(input: {
  monthKey: string;
  today: string;
  /** Ngày bắt đầu tính công (ngày tạo tài khoản). */
  employedFrom: string;
  workingWeekdays: number[];
  holidays: ReadonlyMap<string, string>;
  records: DayRecord[];
  approvedRequests: ApprovedRequest[];
}): MonthlySummary {
  const { monthKey, today, employedFrom, workingWeekdays, holidays, records, approvedRequests } = input;
  const { start, end } = monthRange(monthKey);
  const byDate = new Map(records.map((r) => [r.workDate, r]));

  const s: MonthlySummary = {
    standardDays: 0,
    presentDays: 0,
    businessTripDays: 0,
    annualLeaveDays: 0,
    unpaidLeaveDays: 0,
    paidHolidays: 0,
    absentDays: 0,
    lateCount: 0,
    lateMinutes: 0,
    earlyCount: 0,
    earlyMinutes: 0,
    missingCheckout: 0,
    workedMinutes: 0,
    overtimeMinutes: 0,
    paidDays: 0,
    days: [],
  };

  for (const day of daysInRange(start, end)) {
    const rec = byDate.get(day);
    const holidayName = holidays.get(day);
    const isWorkingWeekday = workingWeekdays.includes(weekdayOf(day));
    const isWorkingDay = isWorkingWeekday && !holidayName;
    const cell: DayCell = { date: day, code: "", isWorkingDay, holidayName, record: rec };
    s.days.push(cell);

    if (rec) s.workedMinutes += rec.workedMinutes;
    if (day < employedFrom) continue;

    if (holidayName) {
      cell.code = "L";
      if (isWorkingWeekday) s.paidHolidays += 1;
      continue;
    }
    if (!isWorkingDay) {
      cell.code = rec?.checkInAt ? "X" : "-";
      continue;
    }

    s.standardDays += 1;
    if (day > today) continue;

    const trip = approvedRequests.find((r) => r.type === "BUSINESS_TRIP" && covers(r, day));
    const leave = approvedRequests.find(
      (r) => (r.type === "ANNUAL_LEAVE" || r.type === "UNPAID_LEAVE") && covers(r, day),
    );
    const leavePortion = leave ? (leave.halfDay ? 0.5 : 1) : 0;
    const addLeave = (portion: number) => {
      if (leave?.type === "ANNUAL_LEAVE") s.annualLeaveDays += portion;
      else s.unpaidLeaveDays += portion;
    };
    const attended = Boolean(rec?.checkInAt);

    if (trip) {
      cell.code = "CT";
      s.businessTripDays += 1;
      continue;
    }

    if (leavePortion === 1) {
      cell.code = leave!.type === "ANNUAL_LEAVE" ? "P" : "KL";
      addLeave(1);
      continue;
    }

    if (attended && rec) {
      s.presentDays += 1 - leavePortion;
      if (rec.lateMinutes > 0) {
        s.lateCount += 1;
        s.lateMinutes += rec.lateMinutes;
      }
      if (rec.earlyMinutes > 0) {
        s.earlyCount += 1;
        s.earlyMinutes += rec.earlyMinutes;
      }
      const forgot = rec.status === "MISSING_CHECKOUT" && day < today;
      if (forgot) s.missingCheckout += 1;

      if (leavePortion > 0) {
        addLeave(leavePortion);
        cell.code = leave!.type === "ANNUAL_LEAVE" ? "P/2" : "KL/2";
      } else if (forgot) {
        cell.code = "Q";
      } else if (rec.lateMinutes > 0 && rec.earlyMinutes > 0) {
        cell.code = "MS";
      } else if (rec.lateMinutes > 0) {
        cell.code = "M";
      } else if (rec.earlyMinutes > 0) {
        cell.code = "S";
      } else {
        cell.code = "X";
      }
      continue;
    }

    // Không chấm công: hôm nay thì chưa kết luận vắng.
    if (day === today) {
      if (leavePortion > 0) {
        addLeave(leavePortion);
        cell.code = leave!.type === "ANNUAL_LEAVE" ? "P/2" : "KL/2";
      }
      continue;
    }
    if (leavePortion > 0) {
      addLeave(leavePortion);
      s.absentDays += 1 - leavePortion;
      cell.code = leave!.type === "ANNUAL_LEAVE" ? "P/2" : "KL/2";
    } else {
      s.absentDays += 1;
      cell.code = "V";
    }
  }

  for (const r of approvedRequests) {
    if (r.type !== "OVERTIME" || r.startKey < start || r.startKey > end) continue;
    if (r.requestedCheckIn && r.requestedCheckOut) {
      s.overtimeMinutes += Math.max(0, Math.floor((r.requestedCheckOut.getTime() - r.requestedCheckIn.getTime()) / 60000));
    }
  }

  s.paidDays = s.presentDays + s.businessTripDays + s.annualLeaveDays + s.paidHolidays;
  return s;
}

export function formatMinutes(min: number): string {
  if (min <= 0) return "0";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}p`;
}
