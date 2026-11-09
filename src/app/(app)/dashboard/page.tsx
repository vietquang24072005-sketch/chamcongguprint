import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getTodayAttendance } from "@/lib/attendance/service";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/labels";
import { formatDateKey, formatTime, minutesToHHmm } from "@/lib/time";
import { PunchButtons } from "./punch-buttons";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Chấm công hôm nay</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-200" />}>
        <TodayCard />
      </Suspense>
    </div>
  );
}

async function TodayCard() {
  const user = await requireUser();
  const { workDate, shift, record } = await getTodayAttendance(user.id, new Date());

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm text-slate-500">Ngày công</p>
          <p className="text-lg font-semibold">{formatDateKey(workDate)}</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          {shift ? (
            <>
              <p className="font-medium text-slate-700">{shift.name}</p>
              <p>
                {minutesToHHmm(shift.startMinute)} – {minutesToHHmm(shift.endMinute)}
              </p>
            </>
          ) : (
            <p>Chưa được gán ca</p>
          )}
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-slate-50 p-4">
          <dt className="text-sm text-slate-500">Giờ vào</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{formatTime(record?.checkInAt)}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <dt className="text-sm text-slate-500">Giờ ra</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{formatTime(record?.checkOutAt)}</dd>
        </div>
      </dl>

      {record && (
        <p className="mt-4">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[record.status]}`}>
            {STATUS_LABEL[record.status]}
          </span>
        </p>
      )}

      <PunchButtons hasCheckedIn={Boolean(record?.checkInAt)} />
    </section>
  );
}
