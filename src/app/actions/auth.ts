"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { loginSchema } from "@/lib/validations/auth";

export type LoginState = { error?: string } | undefined;

// TODO: thêm rate limit cho đăng nhập trước khi đưa lên production.
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const { identifier, password } = parsed.data;
  const user = await db.user.findFirst({
    where: {
      OR: [{ email: identifier.toLowerCase() }, { employeeCode: identifier.toUpperCase() }],
    },
  });

  const valid = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) return { error: "Sai thông tin đăng nhập" };

  await createSession(user.id, user.role);
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
