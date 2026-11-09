"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/form-state";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
  /** Xoá trắng form sau khi gửi thành công (dùng cho form "thêm mới"). */
  resetOnSuccess?: boolean;
  className?: string;
  submitClassName?: string;
};

/** Form gọi Server Action, hiển thị thông báo thành công / lỗi. */
export function ActionForm({ action, children, submitLabel, resetOnSuccess, className, submitClassName }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div>
      <form key={resetOnSuccess && state?.ok ? state.at : "form"} action={formAction} className={className ?? "space-y-3"}>
        {children}
        <button
          disabled={pending}
          className={
            submitClassName ??
            "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          }
        >
          {pending ? "Đang lưu..." : submitLabel}
        </button>
      </form>
      {state && (
        <p
          role="status"
          className={`mt-2 rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}
        >
          {state.ok ? state.message : state.error}
        </p>
      )}
    </div>
  );
}
