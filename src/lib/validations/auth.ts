import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Vui lòng nhập email hoặc mã nhân viên"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export const punchSchema = z.object({
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
});
