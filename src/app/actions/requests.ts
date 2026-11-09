"use server";

import { refresh } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { cancelRequest, createRequest, decideRequest } from "@/lib/requests/service";
import { stamp as withStamp, type ActionResult, type FormState } from "@/lib/form-state";
import { cancelRequestSchema, createRequestSchema, decideRequestSchema } from "@/lib/validations/request";

export async function createRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = createRequestSchema.safeParse({
    type: formData.get("type"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") ?? undefined,
    halfDay: formData.get("halfDay") ?? undefined,
    checkInTime: formData.get("checkInTime") ?? undefined,
    checkOutTime: formData.get("checkOutTime") ?? undefined,
    reason: formData.get("reason"),
  });
  if (!parsed.success) return withStamp({ ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" });

  const result = await createRequest(user, parsed.data, new Date());
  if (result.ok) refresh();
  return withStamp(result);
}

export async function cancelRequestAction(input: { requestId: string; reason?: string }): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = cancelRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dữ liệu không hợp lệ" };
  const result = await cancelRequest(user, parsed.data.requestId, parsed.data.reason, new Date());
  if (result.ok) refresh();
  return result;
}

export async function decideRequestAction(input: {
  requestId: string;
  decision: "APPROVE" | "REJECT";
  note?: string;
}): Promise<ActionResult> {
  const user = await requireRole("MANAGER");
  const parsed = decideRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dữ liệu không hợp lệ" };
  const result = await decideRequest(user, parsed.data.requestId, parsed.data.decision, parsed.data.note, new Date());
  if (result.ok) refresh();
  return result;
}
