import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getLeaveBalance, listMyRequests } from "@/lib/requests/service";
import { localDateKey } from "@/lib/time";
import { RequestSummary } from "@/components/request-summary";
import { RequestForm } from "./request-form";
import { CancelButton } from "./cancel-button";

export default function RequestsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Đơn từ</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}>
        <RequestsContent />
      </Suspense>
    </div>
  );
}

async function RequestsContent() {
  const user = await requireUser();
  const today = localDateKey(new Date());
  const year = Number(today.slice(0, 4));
  const [balance, requests] = await Promise.all([getLeaveBalance(user.id, year), listMyRequests(user.id)]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="space-y-6">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold">Phép năm {year}</h2>
          <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              ["Được cấp", balance.total],
              ["Đã dùng", balance.used],
              ["Chờ duyệt", balance.pending],
              ["Còn lại", balance.remaining],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 px-1 py-3">
                <dd className="text-xl font-semibold tabular-nums">{value}</dd>
                <dt className="text-xs text-slate-500">{label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold">Tạo đơn mới</h2>
          <RequestForm today={today} />
        </section>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">Đơn của tôi</h2>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Bạn chưa gửi đơn nào.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 py-3">
                <RequestSummary r={r} />
                {r.status === "PENDING" && <CancelButton requestId={r.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
