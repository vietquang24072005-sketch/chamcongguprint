import { z } from "zod";
import { isRangeType, type RequestTypeValue } from "@/lib/requests/rules";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalTime = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || HHMM.test(v), "Giờ không hợp lệ (HH:mm)");

export const createRequestSchema = z
  .object({
    type: z.enum(["ANNUAL_LEAVE", "UNPAID_LEAVE", "MISSED_CHECK", "LATE_EARLY", "OVERTIME", "BUSINESS_TRIP"]),
    startDate: z.string().regex(DATE_KEY, "Vui lòng chọn ngày bắt đầu"),
    endDate: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || DATE_KEY.test(v), "Ngày kết thúc không hợp lệ"),
    halfDay: z
      .union([z.literal("on"), z.literal("true"), z.boolean()])
      .optional()
      .transform((v) => v === true || v === "on" || v === "true"),
    checkInTime: optionalTime,
    checkOutTime: optionalTime,
    reason: z.string().trim().min(5, "Lý do tối thiểu 5 ký tự").max(500, "Lý do tối đa 500 ký tự"),
  })
  .transform((v) => {
    const type = v.type as RequestTypeValue;
    const endDate = isRangeType(type) ? (v.endDate ?? v.startDate) : v.startDate;
    return { ...v, type, endDate, halfDay: isRangeType(type) && type !== "BUSINESS_TRIP" ? v.halfDay : false };
  })
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Ngày kết thúc phải sau ngày bắt đầu" });
    }
    if (v.halfDay && v.endDate !== v.startDate) {
      ctx.addIssue({ code: "custom", path: ["halfDay"], message: "Nghỉ nửa ngày chỉ áp dụng cho một ngày" });
    }
    if (v.type === "MISSED_CHECK" && !v.checkInTime && !v.checkOutTime) {
      ctx.addIssue({ code: "custom", path: ["checkInTime"], message: "Nhập giờ vào hoặc giờ ra cần bổ sung" });
    }
    if (v.type === "OVERTIME" && (!v.checkInTime || !v.checkOutTime)) {
      ctx.addIssue({ code: "custom", path: ["checkInTime"], message: "Nhập giờ bắt đầu và kết thúc tăng ca" });
    }
  });

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const decideRequestSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const cancelRequestSchema = z.object({
  requestId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
});
