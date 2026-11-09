"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { adjustAttendance } from "@/lib/attendance/service";
import { firstIssue, stamp, type FormState } from "@/lib/form-state";
import { adjustAttendanceSchema } from "@/lib/validations/report";

export async function adjustAttendanceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("HR");
  const parsed = adjustAttendanceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return stamp({ ok: false, error: firstIssue(parsed.error) });

  const result = await adjustAttendance({ actorId: actor.id, ...parsed.data, now: new Date() });
  if (result.ok) refresh();
  return stamp(result);
}
