import { describe, expect, it } from "vitest";
import { canAssignRole, canManageUser, validateShift, validateUserChange } from "./rules";

const admin = { id: "a1", role: "ADMIN" as const };
const hr = { id: "h1", role: "HR" as const };
const mgr = { id: "m1", role: "MANAGER" as const };

describe("canAssignRole / canManageUser", () => {
  it("ADMIN gán được mọi vai trò", () => {
    expect(canAssignRole(admin, "ADMIN")).toBe(true);
    expect(canAssignRole(admin, "HR")).toBe(true);
  });
  it("HR chỉ gán EMPLOYEE / MANAGER", () => {
    expect(canAssignRole(hr, "MANAGER")).toBe(true);
    expect(canAssignRole(hr, "HR")).toBe(false);
    expect(canAssignRole(hr, "ADMIN")).toBe(false);
  });
  it("HR không sửa được tài khoản HR khác hay ADMIN", () => {
    expect(canManageUser(hr, { id: "h2", role: "HR" })).toBe(false);
    expect(canManageUser(hr, { id: "a1", role: "ADMIN" })).toBe(false);
    expect(canManageUser(hr, { id: "e1", role: "EMPLOYEE" })).toBe(true);
  });
  it("MANAGER không quản trị được ai", () => {
    expect(canManageUser(mgr, { id: "e1", role: "EMPLOYEE" })).toBe(false);
  });
});

describe("validateUserChange", () => {
  const emp = { id: "e1", role: "EMPLOYEE" as const, active: true };
  it("HR nâng nhân viên lên quản lý", () => {
    expect(validateUserChange(hr, emp, { role: "MANAGER", active: true })).toBeNull();
  });
  it("HR không nâng nhân viên lên HR", () => {
    expect(validateUserChange(hr, emp, { role: "HR", active: true })).not.toBeNull();
  });
  it("ADMIN không tự hạ quyền", () => {
    expect(validateUserChange(admin, { ...admin, active: true }, { role: "HR", active: true })).not.toBeNull();
  });
  it("ADMIN không tự khoá", () => {
    expect(validateUserChange(admin, { ...admin, active: true }, { role: "ADMIN", active: false })).not.toBeNull();
  });
  it("ADMIN khoá ADMIN khác", () => {
    expect(validateUserChange(admin, { id: "a2", role: "ADMIN", active: true }, { role: "ADMIN", active: false })).toBeNull();
  });
});

describe("validateShift", () => {
  const h = (x: number) => x * 60;
  it("ca hành chính có nghỉ trưa", () => {
    expect(validateShift({ startMinute: h(8), endMinute: h(17), breakStartMinute: h(12), breakEndMinute: h(13) })).toBeNull();
  });
  it("ca qua đêm, nghỉ sau nửa đêm", () => {
    expect(validateShift({ startMinute: h(22), endMinute: h(6), breakStartMinute: h(2), breakEndMinute: h(2) + 30 })).toBeNull();
  });
  it("giờ vào = giờ ra", () => {
    expect(validateShift({ startMinute: h(8), endMinute: h(8), breakStartMinute: null, breakEndMinute: null })).not.toBeNull();
  });
  it("nghỉ ngoài ca", () => {
    expect(validateShift({ startMinute: h(8), endMinute: h(17), breakStartMinute: h(18), breakEndMinute: h(19) })).not.toBeNull();
  });
  it("thiếu giờ kết thúc nghỉ", () => {
    expect(validateShift({ startMinute: h(8), endMinute: h(17), breakStartMinute: h(12), breakEndMinute: null })).not.toBeNull();
  });
  it("nghỉ kết thúc trước khi bắt đầu", () => {
    expect(validateShift({ startMinute: h(8), endMinute: h(17), breakStartMinute: h(13), breakEndMinute: h(12) })).not.toBeNull();
  });
});
