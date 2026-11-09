"use client";

import { useState, useTransition } from "react";
import { cancelRequestAction } from "@/app/actions/requests";

export function CancelButton({ requestId, label = "Huỷ đơn", confirmText = "Huỷ đơn này?" }: {
  requestId: string;
  label?: string;
  confirmText?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm(confirmText)) return;
          setError(null);
          startTransition(async () => {
            const r = await cancelRequestAction({ requestId });
            if (!r.ok) setError(r.error);
          });
        }}
        className="rounded-lg px-3 py-1.5 text-sm text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-60"
      >
        {pending ? "Đang huỷ..." : label}
      </button>
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
