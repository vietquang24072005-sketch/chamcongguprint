import { Suspense } from "react";
import { hasRole, requireRole } from "@/lib/auth";
import { listRequestsForApprover } from "@/lib/requests/service";
import { RequestSummary } from "@/components/request-summary";
import { DecisionButtons } from "./decision-buttons";
import { CancelButton } from "../requests/cancel-button";

export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Duyệt đơn</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}>
        <ApprovalsContent />
      </Suspense>
    </div>
  );
}

async function ApprovalsContent() {
  const user = await requireRole("MANAGER");
  const [pending, done] = await Promise.all([
    listRequestsForApprover(user, "PENDING"),
    listRequestsForApprover(user, "DONE"),
  ]);
  const isHr = hasRole(user, "HR");

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">
          Chờ duyệt <span className="text-slate-400">({pending.length})</span>
        </h2>
        {!isHr && !user.departmentId && (
          <p className="mt-3 text-sm text-amber-700">Bạn chưa được gán phòng ban nên chưa có đơn nào để duyệt.</p>
        )}
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Không có đơn nào đang chờ.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 py-4">
                <RequestSummary r={r} showOwner />
                <DecisionButtons requestId={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">Đã xử lý gần đây</h2>
        {done.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Chưa có.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {done.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 py-3">
                <RequestSummary r={r} showOwner />
                {isHr && r.status === "APPROVED" && (
                  <CancelButton
                    requestId={r.id}
                    label="Huỷ & hoàn tác"
                    confirmText="Huỷ đơn đã duyệt? Bảng công của những ngày liên quan sẽ được trả về như trước khi duyệt."
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
