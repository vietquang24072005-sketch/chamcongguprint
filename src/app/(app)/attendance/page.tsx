import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { listAttendance } from "@/lib/attendance/service";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/labels";
import { dbDateToKey, formatDateKey, formatTime, localDateKey } from "@/lib/time";

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Lịch sử chấm công tháng này</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-200" />}>
        <AttendanceTable />
      </Suspense>
    </div>
  );
}

async function AttendanceTable() {
  const user = await requireUser();
  const today = localDateKey(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const rows = await listAttendance(user.id, monthStart, today);

  if (rows.length === 0) {
    return <p className="rounded-2xl bg-white p-6 text-slate-500 ring-1 ring-slate-200">Chưa có dữ liệu chấm công.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Ngày</th>
            <th className="px-4 py-3 font-medium">Vào</th>
            <th className="px-4 py-3 font-medium">Ra</th>
            <th className="px-4 py-3 font-medium">Giờ làm</th>
            <th className="px-4 py-3 font-medium">Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3">{formatDateKey(dbDateToKey(r.workDate))}</td>
              <td className="px-4 py-3 tabular-nums">{formatTime(r.checkInAt)}</td>
              <td className="px-4 py-3 tabular-nums">{formatTime(r.checkOutAt)}</td>
              <td className="px-4 py-3 tabular-nums">
                {Math.floor(r.workedMinutes / 60)}h{String(r.workedMinutes % 60).padStart(2, "0")}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
