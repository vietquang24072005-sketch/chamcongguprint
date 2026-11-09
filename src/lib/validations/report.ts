import { z } from "zod";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const blankToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalTime = z.preprocess(blankToUndef, z.string().regex(HHMM, "Giờ không hợp lệ (HH:mm)").optional());

export const adjustAttendanceSchema = z.object({
  userId: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkInTime: optionalTime,
  checkOutTime: optionalTime,
  note: z.preprocess(blankToUndef, z.string().trim().max(300).optional()),
  reason: z.string().trim().min(5, "Lý do sửa tối thiểu 5 ký tự").max(500),
});
