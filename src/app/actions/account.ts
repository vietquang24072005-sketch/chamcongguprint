"use server";

import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { firstIssue, stamp, type FormState } from "@/lib/form-state";
import { changePasswordSchema } from "@/lib/validations/auth";

export async function changeOwnPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return stamp({ ok: false, error: firstIssue(parsed.error) });

  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(parsed.data.currentPassword, row.passwordHash))) {
    return stamp({ ok: false, error: "Mật khẩu hiện tại không đúng" });
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  });
  await audit(db, { actorId: user.id, entity: "user", entityId: user.id, action: "change_own_password" });
  return stamp({ ok: true, message: "Đã đổi mật khẩu" });
}
