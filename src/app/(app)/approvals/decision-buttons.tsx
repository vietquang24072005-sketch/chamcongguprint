"use client";

import { useState, useTransition } from "react";
import { decideRequestAction } from "@/app/actions/requests";

export function DecisionButtons({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "APPROVE" | "REJECT") {
    if (decision === "REJECT" && !note.trim()) {
      setError("Vui lòng ghi lý do từ chối");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await decideRequestAction({ requestId, decision, note });
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="w-full space-y-2 sm:w-64">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ghi chú (bắt buộc khi từ chối)"
        maxLength={500}
        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={pending}
          onClick={() => decide("APPROVE")}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Duyệt
        </button>
        <button
          disabled={pending}
          onClick={() => decide("REJECT")}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-60"
        >
          Từ chối
        </button>
      </div>
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
