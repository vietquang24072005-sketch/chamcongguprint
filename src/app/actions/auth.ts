"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { getRequestInfo } from "@/lib/request-info";
import { isLoginBlocked, LOGIN_WINDOW_MINUTES, normalizeIdentifier } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validations/auth";

export type LoginState = { error?: string } | undefined;

// Hash giả để so sánh khi không tìm thấy tài khoản — thời gian phản hồi như nhau, tránh dò tài khoản.
const DUMMY_HASH = bcrypt.hashSync("khong-phai-mat-khau-that", 10);

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const { password } = parsed.data;
  const identifier = normalizeIdentifier(parsed.data.identifier);
  const { ip } = await getRequestInfo();

  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000);
  const [failsForIdentifier, failsForIp] = await Promise.all([
    db.loginAttempt.count({ where: { identifier, success: false, createdAt: { gte: since } } }),
    ip ? db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }) : 0,
  ]);
  if (isLoginBlocked(failsForIdentifier, failsForIp)) {
    return { error: `Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${LOGIN_WINDOW_MINUTES} phút.` };
  }

  const user = await db.user.findFirst({
    where: { OR: [{ email: identifier }, { employeeCode: identifier.toUpperCase() }] },
  });
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  const valid = Boolean(user && user.active && passwordOk);

  await db.loginAttempt.create({ data: { identifier, ip, success: valid } });
  if (!valid || !user) return { error: "Sai thông tin đăng nhập" };

  await createSession(user.id, user.role);
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
