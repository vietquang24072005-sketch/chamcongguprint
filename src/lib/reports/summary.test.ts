import { describe, expect, it } from "vitest";
import { buildMonthlySummary, monthRange, type ApprovedRequest, type DayRecord } from "./summary";

const MON_FRI = [1, 2, 3, 4, 5];
const vn = (iso: string) => new Date(`${iso}+07:00`);

function rec(workDate: string, extra: Partial<DayRecord> = {}): DayRecord {
  return {
    workDate,
    checkInAt: vn(`${workDate}T08:00:00`),
    checkOutAt: vn(`${workDate}T17:00:00`),
    status: "PRESENT",
    lateMinutes: 0,
    earlyMinutes: 0,
    workedMinutes: 480,
    ...extra,
  };
}

function req(type: ApprovedRequest["type"], startKey: string, endKey = startKey, extra: Partial<ApprovedRequest> = {}): ApprovedRequest {
  return { type, startKey, endKey, halfDay: false, requestedCheckIn: null, requestedCheckOut: null, ...extra };
}

// Tháng 11/2026: 01 là CN; ngày làm việc T2–T6 = 21 ngày.
const base = {
  monthKey: "2026-11",
  today: "2026-12-01", // cả tháng đã qua
  employedFrom: "2020-01-01",
  workingWeekdays: MON_FRI,
  holidays: new Map<string, string>(),
  records: [] as DayRecord[],
  approvedRequests: [] as ApprovedRequest[],
};

describe("monthRange", () => {
  it("tháng 2 năm thường", () => expect(monthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" }));
  it("tháng 2 năm nhuận", () => expect(monthRange("2028-02").end).toBe("2028-02-29"));
});

describe("buildMonthlySummary", () => {
  it("không chấm ngày nào: vắng toàn bộ ngày làm việc", () => {
    const s = buildMonthlySummary(base);
    expect(s.standardDays).toBe(21);
    expect(s.absentDays).toBe(21);
    expect(s.paidDays).toBe(0);
    expect(s.days.find((d) => d.date === "2026-11-01")?.code).toBe("-");
  });

  it("đi muộn, về sớm, quên check-out", () => {
    const s = buildMonthlySummary({
      ...base,
      records: [
        rec("2026-11-02"),
        rec("2026-11-03", { lateMinutes: 15, status: "LATE" }),
        rec("2026-11-04", { earlyMinutes: 30, status: "EARLY_LEAVE" }),
        rec("2026-11-05", { checkOutAt: null, status: "MISSING_CHECKOUT", workedMinutes: 0 }),
      ],
    });
    expect(s.presentDays).toBe(4);
    expect(s.lateCount).toBe(1);
    expect(s.lateMinutes).toBe(15);
    expect(s.earlyMinutes).toBe(30);
    expect(s.missingCheckout).toBe(1);
    expect(s.absentDays).toBe(17);
    const codes = Object.fromEntries(s.days.map((d) => [d.date, d.code]));
    expect([codes["2026-11-02"], codes["2026-11-03"], codes["2026-11-04"], codes["2026-11-05"]]).toEqual(["X", "M", "S", "Q"]);
  });

  it("hôm nay chưa chấm công thì chưa tính vắng; quên check-out hôm nay chưa tính", () => {
    const s = buildMonthlySummary({
      ...base,
      today: "2026-11-03",
      records: [rec("2026-11-03", { checkOutAt: null, status: "MISSING_CHECKOUT" })],
    });
    expect(s.absentDays).toBe(1); // chỉ 02/11
    expect(s.missingCheckout).toBe(0);
    expect(s.standardDays).toBe(21);
  });

  it("ngày lễ rơi vào ngày làm việc được tính công, không tính vắng", () => {
    const s = buildMonthlySummary({ ...base, holidays: new Map([["2026-11-20", "Lễ test"]]) });
    expect(s.standardDays).toBe(20);
    expect(s.paidHolidays).toBe(1);
    expect(s.absentDays).toBe(20);
    expect(s.days.find((d) => d.date === "2026-11-20")?.code).toBe("L");
  });

  it("phép năm cả ngày và nửa ngày, không lương", () => {
    const s = buildMonthlySummary({
      ...base,
      today: "2026-11-09",
      records: [rec("2026-11-02"), rec("2026-11-05")],
      approvedRequests: [
        req("ANNUAL_LEAVE", "2026-11-03"),
        req("UNPAID_LEAVE", "2026-11-04"),
        req("ANNUAL_LEAVE", "2026-11-05", "2026-11-05", { halfDay: true }),
        req("ANNUAL_LEAVE", "2026-11-06", "2026-11-06", { halfDay: true }),
      ],
    });
    // 02 X; 03 P; 04 KL; 05 P/2 + làm nửa ngày; 06 P/2 + vắng nửa ngày
    expect(s.presentDays).toBe(1.5);
    expect(s.annualLeaveDays).toBe(2);
    expect(s.unpaidLeaveDays).toBe(1);
    expect(s.absentDays).toBe(0.5);
    expect(s.paidDays).toBe(3.5);
  });

  it("công tác tính công dù không chấm", () => {
    const s = buildMonthlySummary({ ...base, today: "2026-11-03", approvedRequests: [req("BUSINESS_TRIP", "2026-11-02", "2026-11-03")] });
    expect(s.businessTripDays).toBe(2);
    expect(s.absentDays).toBe(0);
    expect(s.paidDays).toBe(2);
  });

  it("tăng ca cộng theo đơn đã duyệt trong tháng", () => {
    const s = buildMonthlySummary({
      ...base,
      approvedRequests: [
        req("OVERTIME", "2026-11-10", "2026-11-10", {
          requestedCheckIn: vn("2026-11-10T18:00:00"),
          requestedCheckOut: vn("2026-11-10T20:30:00"),
        }),
        req("OVERTIME", "2026-10-31", "2026-10-31", {
          requestedCheckIn: vn("2026-10-31T18:00:00"),
          requestedCheckOut: vn("2026-10-31T20:00:00"),
        }),
      ],
    });
    expect(s.overtimeMinutes).toBe(150);
  });

  it("vào làm giữa tháng: chỉ tính từ ngày vào", () => {
    const s = buildMonthlySummary({ ...base, employedFrom: "2026-11-16" });
    expect(s.standardDays).toBe(11); // 16–30/11
    expect(s.absentDays).toBe(11);
    expect(s.days.find((d) => d.date === "2026-11-02")?.code).toBe("");
  });

  it("làm cuối tuần: hiện X, cộng giờ làm, không cộng ngày công chuẩn", () => {
    const s = buildMonthlySummary({ ...base, records: [rec("2026-11-07")] });
    expect(s.days.find((d) => d.date === "2026-11-07")?.code).toBe("X");
    expect(s.workedMinutes).toBe(480);
    expect(s.presentDays).toBe(0);
  });
});
