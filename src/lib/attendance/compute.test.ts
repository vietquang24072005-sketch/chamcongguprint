import { describe, expect, it } from "vitest";
import { computeAttendance, resolveWorkDate, type ShiftRule } from "./compute";

/** Tạo thời điểm từ giờ VN (UTC+7). */
const vn = (iso: string) => new Date(`${iso}+07:00`);

const office: ShiftRule = {
  startMinute: 8 * 60,
  endMinute: 17 * 60,
  breakStartMinute: 12 * 60,
  breakEndMinute: 13 * 60,
  lateGraceMinutes: 5,
  earlyGraceMinutes: 5,
};

const night: ShiftRule = {
  startMinute: 22 * 60,
  endMinute: 6 * 60,
  breakStartMinute: 2 * 60,
  breakEndMinute: 2 * 60 + 30,
  lateGraceMinutes: 5,
  earlyGraceMinutes: 5,
};

describe("resolveWorkDate", () => {
  it("ca hành chính: ngày công là ngày theo giờ VN, kể cả khi UTC còn là hôm trước", () => {
    // 06:30 VN ngày 10 = 23:30 UTC ngày 9
    expect(resolveWorkDate(vn("2026-11-10T06:30:00"), office)).toBe("2026-11-10");
  });

  it("ca qua đêm: chấm lúc 05:50 sáng thuộc ca của hôm trước", () => {
    expect(resolveWorkDate(vn("2026-11-10T05:50:00"), night)).toBe("2026-11-09");
  });

  it("ca qua đêm: chấm lúc 21:55 thuộc ca của chính ngày đó", () => {
    expect(resolveWorkDate(vn("2026-11-09T21:55:00"), night)).toBe("2026-11-09");
  });

  it("không có ca: dùng ngày theo giờ VN", () => {
    expect(resolveWorkDate(vn("2026-11-10T00:10:00"), null)).toBe("2026-11-10");
  });
});

describe("computeAttendance — ca hành chính", () => {
  const base = { workDate: "2026-11-10", shift: office };

  it("đúng giờ, đủ công: 8 tiếng (trừ 1 tiếng nghỉ trưa)", () => {
    const r = computeAttendance({ ...base, checkInAt: vn("2026-11-10T07:55:00"), checkOutAt: vn("2026-11-10T17:02:00") });
    expect(r).toEqual({ status: "PRESENT", lateMinutes: 0, earlyMinutes: 0, workedMinutes: 480 });
  });

  it("muộn đúng ngưỡng cho phép (5 phút) không tính muộn", () => {
    const r = computeAttendance({ ...base, checkInAt: vn("2026-11-10T08:05:00"), checkOutAt: vn("2026-11-10T17:00:00") });
    expect(r.status).toBe("PRESENT");
    expect(r.lateMinutes).toBe(0);
  });

  it("muộn quá ngưỡng tính toàn bộ số phút muộn", () => {
    const r = computeAttendance({ ...base, checkInAt: vn("2026-11-10T08:06:00"), checkOutAt: vn("2026-11-10T17:00:00") });
    expect(r.status).toBe("LATE");
    expect(r.lateMinutes).toBe(6);
  });

  it("về sớm", () => {
    const r = computeAttendance({ ...base, checkInAt: vn("2026-11-10T08:00:00"), checkOutAt: vn("2026-11-10T16:30:00") });
    expect(r.status).toBe("EARLY_LEAVE");
    expect(r.earlyMinutes).toBe(30);
    expect(r.workedMinutes).toBe(450);
  });

  it("vừa muộn vừa về sớm", () => {
    const r = computeAttendance({ ...base, checkInAt: vn("2026-11-10T08:30:00"), checkOutAt: vn("2026-11-10T16:00:00") });
    expect(r.status).toBe("LATE_AND_EARLY");
  });

  it("chưa check-out", () => {
    const r = computeAttendance({ ...base, checkInAt: vn("2026-11-10T08:00:00"), checkOutAt: null });
    expect(r.status).toBe("MISSING_CHECKOUT");
    expect(r.workedMinutes).toBe(0);
  });

  it("chỉ làm buổi sáng: không trừ nghỉ trưa", () => {
    const r = computeAttendance({ ...base, checkInAt: vn("2026-11-10T08:00:00"), checkOutAt: vn("2026-11-10T12:00:00") });
    expect(r.workedMinutes).toBe(240);
  });
});

describe("computeAttendance — ca qua đêm", () => {
  it("22:00 → 06:00 hôm sau: 7.5 tiếng (trừ 30 phút nghỉ)", () => {
    const r = computeAttendance({
      workDate: "2026-11-09",
      shift: night,
      checkInAt: vn("2026-11-09T21:58:00"),
      checkOutAt: vn("2026-11-10T06:01:00"),
    });
    expect(r).toEqual({ status: "PRESENT", lateMinutes: 0, earlyMinutes: 0, workedMinutes: 450 });
  });

  it("về sớm lúc 05:00", () => {
    const r = computeAttendance({
      workDate: "2026-11-09",
      shift: night,
      checkInAt: vn("2026-11-09T22:00:00"),
      checkOutAt: vn("2026-11-10T05:00:00"),
    });
    expect(r.status).toBe("EARLY_LEAVE");
    expect(r.earlyMinutes).toBe(60);
  });
});
