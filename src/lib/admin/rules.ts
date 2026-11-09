/**
 * Quy tắc phân quyền cho trang Quản trị — hàm thuần.
 *
 * - ADMIN quản lý mọi tài khoản, gán được mọi vai trò.
 * - HR chỉ quản lý tài khoản EMPLOYEE / MANAGER và chỉ gán được hai vai trò đó.
 * - Không ai tự đổi vai trò hay tự khoá tài khoản của mình (tránh tự khoá mất quyền quản trị).
 */
export type RoleValue = "EMPLOYEE" | "MANAGER" | "HR" | "ADMIN";

type Actor = { id: string; role: RoleValue };

const HR_MANAGEABLE: RoleValue[] = ["EMPLOYEE", "MANAGER"];

export function canAssignRole(actor: Actor, role: RoleValue): boolean {
  if (actor.role === "ADMIN") return true;
  if (actor.role === "HR") return HR_MANAGEABLE.includes(role);
  return false;
}

export function canManageUser(actor: Actor, target: { id: string; role: RoleValue }): boolean {
  if (actor.role === "ADMIN") return true;
  if (actor.role === "HR") return HR_MANAGEABLE.includes(target.role);
  return false;
}

export type UserChange = { role: RoleValue; active: boolean };

/** Kiểm tra một lần cập nhật tài khoản. Trả về thông báo lỗi hoặc null nếu hợp lệ. */
export function validateUserChange(
  actor: Actor,
  target: { id: string; role: RoleValue; active: boolean },
  next: UserChange,
): string | null {
  if (!canManageUser(actor, target)) return "Bạn không có quyền sửa tài khoản này";
  if (!canAssignRole(actor, next.role)) return "Bạn không có quyền gán vai trò này";
  if (actor.id === target.id) {
    if (next.role !== target.role) return "Không thể tự đổi vai trò của mình";
    if (!next.active) return "Không thể tự khoá tài khoản của mình";
  }
  return null;
}

/** Chuyển "HH:mm" thành số phút kể từ 00:00. */
export function hhmmToMinute(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Kiểm tra cấu hình ca. Trả về thông báo lỗi hoặc null. */
export function validateShift(s: {
  startMinute: number;
  endMinute: number;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
}): string | null {
  if (s.startMinute === s.endMinute) return "Giờ bắt đầu và kết thúc ca không được trùng nhau";
  const hasBreakStart = s.breakStartMinute !== null;
  const hasBreakEnd = s.breakEndMinute !== null;
  if (hasBreakStart !== hasBreakEnd) return "Nhập đủ cả giờ bắt đầu và kết thúc nghỉ giữa ca";
  if (hasBreakStart && hasBreakEnd) {
    if (s.breakEndMinute! <= s.breakStartMinute!) return "Giờ nghỉ phải kết thúc sau khi bắt đầu";
    // Giờ nghỉ phải nằm trong ca (xét cả ca qua đêm).
    const toOffset = (m: number) => (m - s.startMinute + 1440) % 1440;
    const length = toOffset(s.endMinute) || 1440;
    if (toOffset(s.breakStartMinute!) >= length || toOffset(s.breakEndMinute!) > length) {
      return "Giờ nghỉ phải nằm trong ca làm việc";
    }
    if (toOffset(s.breakEndMinute!) < toOffset(s.breakStartMinute!)) return "Giờ nghỉ phải nằm trong ca làm việc";
  }
  return null;
}
