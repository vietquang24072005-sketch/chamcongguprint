import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import type { Role } from "@/generated/prisma/enums";

export type CurrentUser = {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string;
  role: Role;
  departmentId: string | null;
};

/** Data Access Layer: đọc phiên rồi tải user. Dedupe trong cùng một request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, fullName: true, email: true, employeeCode: true, role: true, departmentId: true, active: true },
  });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    employeeCode: user.employeeCode,
    role: user.role,
    departmentId: user.departmentId,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

const ROLE_RANK: Record<Role, number> = { EMPLOYEE: 0, MANAGER: 1, HR: 2, ADMIN: 3 };

export function hasRole(user: Pick<CurrentUser, "role">, min: Role): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[min];
}

/** Dùng trong Server Component / Server Action: chặn nếu không đủ quyền. */
export async function requireRole(min: Role): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRole(user, min)) redirect("/dashboard");
  return user;
}
