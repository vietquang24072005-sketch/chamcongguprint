"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/form-state";

/** Nút gọi một Server Action đã bind sẵn tham số, có hộp thoại xác nhận. */
export function ConfirmButton({
  action,
  label,
  confirmText,
  className,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  confirmText: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(confirmText)) return;
          setError(null);
          startTransition(async () => {
            const r = await action();
            if (!r.ok) setError(r.error);
          });
        }}
        className={
          className ??
          "rounded-lg px-2.5 py-1 text-sm text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-60"
        }
      >
        {pending ? "..." : label}
      </button>
      {error && <span className="mt-1 max-w-xs text-right text-xs text-rose-700">{error}</span>}
    </span>
  );
}
