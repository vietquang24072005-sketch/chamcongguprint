import { describe, expect, it } from "vitest";
import {
  canApprove,
  countLeaveDays,
  daysInRange,
  leaveDaysInYear,
  rangesOverlap,
  workingDaysInRange,
} from "./rules";

const MON_FRI = [1, 2, 3, 4, 5];
const noHolidays = new Set<string>();

describe("daysInRange", () => {
  it("bao gồm cả hai đầu, qua ranh giới tháng", () => {
    expect(daysInRange("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("workingDaysInRange", () => {
  it("bỏ thứ 7, chủ nhật", () => {
    // 2026-11-13 là thứ 6, 14-15 là cuối tuần, 16 là thứ 2
    expect(workingDaysInRange("2026-11-13", "2026-11-16", MON_FRI, noHolidays)).toEqual(["2026-11-13", "2026-11-16"]);
  });
  it("bỏ ngày lễ", () => {
    expect(workingDaysInRange("2026-09-01", "2026-09-03", MON_FRI, new Set(["2026-09-02"]))).toEqual([
      "2026-09-01",
      "2026-09-03",
    ]);
  });
  it("công ty làm thứ 7", () => {
    expect(workingDaysInRange("2026-11-14", "2026-11-15", [1, 2, 3, 4, 5, 6], noHolidays)).toEqual(["2026-11-14"]);
  });
});

describe("countLeaveDays", () => {
  it("nghỉ cả tuần = 5 ngày", () => {
    expect(countLeaveDays({ startKey: "2026-11-16", endKey: "2026-11-22", halfDay: false }, MON_FRI, noHolidays)).toBe(5);
  });
  it("nửa ngày = 0.5", () => {
    expect(countLeaveDays({ startKey: "2026-11-16", endKey: "2026-11-16", halfDay: true }, MON_FRI, noHolidays)).toBe(0.5);
  });
  it("chỉ chọn cuối tuần = 0", () => {
    expect(countLeaveDays({ startKey: "2026-11-14", endKey: "2026-11-15", halfDay: false }, MON_FRI, noHolidays)).toBe(0);
  });
});

describe("leaveDaysInYear", () => {
  it("đơn vắt qua năm chỉ tính phần của năm được hỏi", () => {
    const reqs = [{ startKey: "2026-12-30", endKey: "2027-01-05", halfDay: false }];
    // 30, 31/12/2026 (T4, T5); 01/01/2027 là lễ; 04, 05/01/2027 (T2, T3)
    const holidays = new Set(["2027-01-01"]);
    expect(leaveDaysInYear(reqs, 2026, MON_FRI, holidays)).toBe(2);
    expect(leaveDaysInYear(reqs, 2027, MON_FRI, holidays)).toBe(2);
  });
});

describe("rangesOverlap", () => {
  it("chạm đầu là trùng", () => expect(rangesOverlap("2026-11-10", "2026-11-12", "2026-11-12", "2026-11-13")).toBe(true));
  it("liền kề không trùng", () => expect(rangesOverlap("2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13")).toBe(false));
});

describe("canApprove", () => {
  const emp = { id: "e1", departmentId: "tech" };
  it("quản lý cùng phòng được duyệt", () => {
    expect(canApprove({ id: "m1", role: "MANAGER", departmentId: "tech" }, emp)).toBe(true);
  });
  it("quản lý khác phòng không được duyệt", () => {
    expect(canApprove({ id: "m2", role: "MANAGER", departmentId: "sales" }, emp)).toBe(false);
  });
  it("quản lý chưa có phòng ban không được duyệt", () => {
    expect(canApprove({ id: "m3", role: "MANAGER", departmentId: null }, { id: "e2", departmentId: null })).toBe(false);
  });
  it("HR duyệt mọi phòng", () => {
    expect(canApprove({ id: "h1", role: "HR", departmentId: null }, emp)).toBe(true);
  });
  it("không tự duyệt đơn của mình", () => {
    expect(canApprove({ id: "h1", role: "HR", departmentId: null }, { id: "h1", departmentId: null })).toBe(false);
  });
  it("nhân viên không duyệt được", () => {
    expect(canApprove({ id: "e9", role: "EMPLOYEE", departmentId: "tech" }, emp)).toBe(false);
  });
});
