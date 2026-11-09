import { isIP } from "node:net";
import { z } from "zod";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const ROLES = ["EMPLOYEE", "MANAGER", "HR", "ADMIN"] as const;

/** Chuỗi rỗng → undefined. */
const blankToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const optionalId = z.preprocess(blankToUndef, z.string().min(1).optional());

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

const userBase = {
  fullName: z.string().trim().min(2, "Họ tên tối thiểu 2 ký tự").max(100),
  email: z.string().trim().toLowerCase().pipe(z.email("Email không hợp lệ")),
  employeeCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,20}$/, "Mã nhân viên 2–20 ký tự: chữ, số, gạch ngang"),
  role: z.enum(ROLES),
  departmentId: optionalId,
  shiftId: optionalId,
  annualLeaveDays: z.coerce
    .number({ error: "Số ngày phép không hợp lệ" })
    .min(0, "Số ngày phép không được âm")
    .max(60, "Tối đa 60 ngày")
    .refine((v) => Number.isInteger(v * 2), "Số ngày phép phải là bội của 0.5"),
};

const password = z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(100);

export const createUserSchema = z.object({ ...userBase, password });

export const updateUserSchema = z.object({ ...userBase, id: z.string().min(1), active: checkbox });

export const resetPasswordSchema = z.object({ id: z.string().min(1), password });

export const departmentSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(2, "Tên phòng ban tối thiểu 2 ký tự").max(100),
});

const optionalTime = z.preprocess(blankToUndef, z.string().regex(HHMM, "Giờ không hợp lệ").optional());

export const shiftSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(2, "Tên ca tối thiểu 2 ký tự").max(50),
  start: z.string().regex(HHMM, "Giờ bắt đầu không hợp lệ"),
  end: z.string().regex(HHMM, "Giờ kết thúc không hợp lệ"),
  breakStart: optionalTime,
  breakEnd: optionalTime,
  lateGraceMinutes: z.coerce.number().int().min(0).max(120),
  earlyGraceMinutes: z.coerce.number().int().min(0).max(120),
});

export const holidaySchema = z.object({
  date: z.string().regex(DATE_KEY, "Vui lòng chọn ngày"),
  name: z.string().trim().min(2, "Tên ngày lễ tối thiểu 2 ký tự").max(100),
});

export const appConfigSchema = z.object({
  locationMode: z.enum(["NONE", "GPS", "IP", "GPS_OR_IP", "GPS_AND_IP"]),
  workingWeekdays: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1, "Chọn ít nhất một ngày làm việc")
    .transform((days) => [...new Set(days)].sort()),
});

export const officeSchema = z.object({
  name: z.string().trim().min(2, "Tên văn phòng tối thiểu 2 ký tự").max(100),
  latitude: z.coerce.number().min(-90, "Vĩ độ không hợp lệ").max(90, "Vĩ độ không hợp lệ"),
  longitude: z.coerce.number().min(-180, "Kinh độ không hợp lệ").max(180, "Kinh độ không hợp lệ"),
  radiusM: z.coerce.number().int().min(20, "Bán kính tối thiểu 20m").max(5000, "Bán kính tối đa 5000m"),
});

/** IP đơn (IPv4/IPv6) hoặc dải CIDR IPv4. */
export const allowedIpSchema = z.object({
  cidr: z
    .string()
    .trim()
    .refine((v) => {
      const [addr, bits, extra] = v.split("/");
      if (extra !== undefined) return false;
      if (bits === undefined) return isIP(addr) !== 0;
      return isIP(addr) === 4 && /^\d{1,2}$/.test(bits) && Number(bits) <= 32;
    }, "Nhập IP (vd. 203.0.113.5) hoặc dải CIDR IPv4 (vd. 192.168.1.0/24)"),
  description: z.preprocess(blankToUndef, z.string().trim().max(100).optional()),
});
