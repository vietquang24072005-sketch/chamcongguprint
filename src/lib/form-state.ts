export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Kết quả trả về cho useActionState; `at` giúp phân biệt hai lần gửi liên tiếp. */
export type FormState = (ActionResult & { at: number }) | undefined;

export function stamp(r: ActionResult): FormState {
  return { ...r, at: Date.now() };
}

export function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Dữ liệu không hợp lệ";
}
