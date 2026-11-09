import { REQUEST_STATUS_CLASS, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL } from "@/lib/labels";
import type { RequestListItem } from "@/lib/requests/service";
import { dbDateToKey, formatDateKey, formatTime } from "@/lib/time";

export function requestDateText(r: Pick<RequestListItem, "startDate" | "endDate" | "halfDay">): string {
  const start = formatDateKey(dbDateToKey(r.startDate));
  const end = formatDateKey(dbDateToKey(r.endDate));
  const range = start === end ? start : `${start} → ${end}`;
  return r.halfDay ? `${range} (nửa ngày)` : range;
}

/** Thông tin chung của một đơn, dùng ở cả trang Đơn từ và Duyệt đơn. */
export function RequestSummary({ r, showOwner = false }: { r: RequestListItem; showOwner?: boolean }) {
  const hasTimes = r.requestedCheckIn || r.requestedCheckOut;
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{REQUEST_TYPE_LABEL[r.type]}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REQUEST_STATUS_CLASS[r.status]}`}>
          {REQUEST_STATUS_LABEL[r.status]}
        </span>
      </div>
      {showOwner && (
        <p className="text-sm text-slate-700">
          {r.user.fullName} <span className="text-slate-400">· {r.user.employeeCode}</span>
          {r.user.department && <span className="text-slate-400"> · {r.user.department.name}</span>}
        </p>
      )}
      <p className="text-sm text-slate-600">
        {requestDateText(r)}
        {hasTimes && (
          <span className="text-slate-500">
            {" "}
            · {formatTime(r.requestedCheckIn)} – {formatTime(r.requestedCheckOut)}
          </span>
        )}
      </p>
      <p className="text-sm break-words text-slate-500">Lý do: {r.reason}</p>
      {r.status !== "PENDING" && r.approver && (
        <p className="text-xs text-slate-400">
          Xử lý bởi {r.approver.fullName}
          {r.decisionNote ? ` — ${r.decisionNote}` : ""}
        </p>
      )}
    </div>
  );
}
