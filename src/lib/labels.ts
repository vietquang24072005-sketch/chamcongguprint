/** Nội dung hiển thị tiếng Việt cho các giá trị enum. */
import type { AttendanceStatus, RequestStatus, RequestType, Role } from "@/generated/prisma/enums";

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  ANNUAL_LEAVE: "Nghỉ phép năm",
  UNPAID_LEAVE: "Nghỉ không lương",
  MISSED_CHECK: "Quên chấm công",
  LATE_EARLY: "Đi muộn / về sớm",
  OVERTIME: "Tăng ca",
  BUSINESS_TRIP: "Công tác",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  CANCELLED: "Đã huỷ",
};

export const REQUEST_STATUS_CLASS: Record<RequestStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-slate-100 text-slate-600",
};

export const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: "Nhân viên",
  MANAGER: "Quản lý",
  HR: "Nhân sự",
  ADMIN: "Quản trị",
};

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Đủ công",
  LATE: "Đi muộn",
  EARLY_LEAVE: "Về sớm",
  LATE_AND_EARLY: "Muộn & về sớm",
  MISSING_CHECKOUT: "Chưa check-out",
  ABSENT: "Vắng mặt",
  ON_LEAVE: "Nghỉ phép",
  HOLIDAY: "Ngày lễ",
};

export const STATUS_CLASS: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800",
  LATE: "bg-amber-100 text-amber-800",
  EARLY_LEAVE: "bg-amber-100 text-amber-800",
  LATE_AND_EARLY: "bg-orange-100 text-orange-800",
  MISSING_CHECKOUT: "bg-sky-100 text-sky-800",
  ABSENT: "bg-rose-100 text-rose-800",
  ON_LEAVE: "bg-violet-100 text-violet-800",
  HOLIDAY: "bg-slate-100 text-slate-700",
};
