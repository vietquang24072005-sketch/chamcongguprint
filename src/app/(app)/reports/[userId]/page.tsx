import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { getEmployeeMonth, resolveMonth } from "@/lib/reports/service";
import { formatMinutes } from "@/lib/reports/summary";
import { weekdayOf } from "@/lib/requests/rules";
import { formatDateKey, formatTime, minutesToHHmm } from "@/lib/time";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputBase, inputClass } from "@/components/fields";
import { DayCodeBadge } from "@/components/day-code";
import { adjustAttendanceAction } from "@/app/actions/reports";

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function EmployeeReportPage({ params, searchParams }: PageProps<"/reports/[userId]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}>
      <EmployeeReport params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EmployeeReport({
  params,
  searchParams,
}: {
  params: PageProps<"/reports/[userId]">["params"];
  searchParams: PageProps<"/reports/[userId]">["searchParams"];
}) {
  const actor = await requireRole("HR");
  const [{ userId }, sp] = await Promise.all([params, searchParams]);
  const now = new Date();
  const month = resolveMonth(sp.month, now);
  const data = await getEmployeeMonth(userId, month, now);
  if (!data) notFound();
  const { user, summary: s, notes, today } = data;
  const canEdit = actor.id !== user.id;

  const stats: [string, string][] = [
    ["Công chuẩn", num(s.standardDays)],
    ["Có mặt", num(s.presentDays)],
    ["Phép năm", num(s.annualLeaveDays)],
    ["Không lương", num(s.unpaidLeaveDays)],
    ["Công tác", num(s.businessTripDays)],
    ["Vắng", num(s.absentDays)],
    ["Đi muộn", s.lateCount ? `${s.lateCount} lần · ${formatMinutes(s.lateMinutes)}` : "0"],
    ["Về sớm", s.earlyCount ? `${s.earlyCount} lần · ${formatMinutes(s.earlyMinutes)}` : "0"],
    ["Giờ làm", formatMinutes(s.workedMinutes)],
    ["Tăng ca", formatMinutes(s.overtimeMinutes)],
    ["Công tính lương", num(s.paidDays)],
  ];

  return (
    <div className="space-y-6">
      <Link href={`/reports?month=${month}`} className="text-sm text-blue-700 hover:underline">
        ← Bảng công tháng
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{user.fullName}</h1>
          <p className="text-sm text-slate-500">
            {user.employeeCode}
            {user.department && ` · ${user.department.name}`}
            {user.shift
              ? ` · ${user.shift.name} ${minutesToHHmm(user.shift.startMinute)}–${minutesToHHmm(user.shift.endMinute)}`
              : " · chưa gán ca"}
          </p>
        </div>
        <form className="flex items-end gap-2">
          <input type="month" name="month" defaultValue={month} className={inputBase} />
          <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700">Xem</button>
        </form>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <Card title="Từng ngày">
        {!canEdit && <p className="mb-3 text-sm text-amber-700">Bạn không thể tự sửa công của chính mình.</p>}
        <ul className="divide-y divide-slate-100">
          {s.days.map((d) => {
            const r = d.record;
            const note = notes.get(d.date);
            const editable = canEdit && d.date <= today;
            return (
              <li key={d.date} className={`py-2 ${d.isWorkingDay ? "" : "bg-slate-50/60"}`}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="w-24 tabular-nums">
                    {WEEKDAY[weekdayOf(d.date)]} {formatDateKey(d.date).slice(0, 5)}
                  </span>
                  <span className="w-10">
                    <DayCodeBadge code={d.code} />
                  </span>
                  <span className="w-28 tabular-nums text-slate-600">
                    {r?.checkInAt || r?.checkOutAt ? `${formatTime(r.checkInAt)} – ${formatTime(r.checkOutAt)}` : ""}
                  </span>
                  <span className="w-16 tabular-nums text-slate-600">{r?.workedMinutes ? formatMinutes(r.workedMinutes) : ""}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-500" title={note ?? d.holidayName ?? ""}>
                    {d.holidayName ?? note ?? ""}
                  </span>
                  {editable && (
                    <details className="w-full sm:w-auto">
                      <summary className="cursor-pointer text-right text-xs text-blue-700">Sửa công</summary>
                      <div className="mt-2 rounded-lg bg-slate-50 p-3 sm:w-[28rem]">
                        <ActionForm action={adjustAttendanceAction} submitLabel="Lưu">
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="workDate" value={d.date} />
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Giờ vào">
                              <input
                                type="time"
                                name="checkInTime"
                                defaultValue={r?.checkInAt ? formatTime(r.checkInAt) : ""}
                                className={inputClass}
                              />
                            </Field>
                            <Field label="Giờ ra">
                              <input
                                type="time"
                                name="checkOutTime"
                                defaultValue={r?.checkOutAt ? formatTime(r.checkOutAt) : ""}
                                className={inputClass}
                              />
                            </Field>
                          </div>
                          <Field label="Ghi chú hiển thị">
                            <input name="note" defaultValue={note ?? ""} maxLength={300} className={inputClass} />
                          </Field>
                          <Field label="Lý do sửa (lưu vào nhật ký)">
                            <input name="reason" required minLength={5} maxLength={500} className={inputClass} />
                          </Field>
                          <p className="text-xs text-slate-500">
                            Bỏ trống cả hai giờ để đánh dấu vắng. Công được tính lại theo ca của nhân viên.
                          </p>
                        </ActionForm>
                      </div>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
