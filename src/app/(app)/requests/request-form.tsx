"use client";

import { useActionState, useState } from "react";
import { createRequestAction } from "@/app/actions/requests";
import { REQUEST_TYPE_LABEL } from "@/lib/labels";
import type { RequestType } from "@/generated/prisma/enums";

const TYPES = Object.keys(REQUEST_TYPE_LABEL) as RequestType[];
const RANGE: RequestType[] = ["ANNUAL_LEAVE", "UNPAID_LEAVE", "BUSINESS_TRIP"];
const HALF_DAY: RequestType[] = ["ANNUAL_LEAVE", "UNPAID_LEAVE"];
const TIMES: RequestType[] = ["MISSED_CHECK", "OVERTIME"];

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function RequestForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(createRequestAction, undefined);

  return (
    <>
      {/* Đổi key sau khi gửi thành công để xoá trắng form */}
      <form key={state?.ok ? state.at : "form"} action={action} className="mt-4 space-y-4">
        <Fields today={today} />
        <button
          disabled={pending}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Đang gửi..." : "Gửi đơn"}
        </button>
      </form>
      {state && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}
        >
          {state.ok ? state.message : state.error}
        </p>
      )}
    </>
  );
}

function Fields({ today }: { today: string }) {
  const [type, setType] = useState<RequestType>("ANNUAL_LEAVE");
  const [halfDay, setHalfDay] = useState(false);
  const isRange = RANGE.includes(type);
  const showTimes = TIMES.includes(type);

  return (
    <>
      <label className="block">
        <span className="text-sm font-medium">Loại đơn</span>
        <select name="type" value={type} onChange={(e) => setType(e.target.value as RequestType)} className={inputClass}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {REQUEST_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">{isRange && !halfDay ? "Từ ngày" : "Ngày"}</span>
          <input
            type="date"
            name="startDate"
            required
            defaultValue={today}
            max={type === "MISSED_CHECK" ? today : undefined}
            className={inputClass}
          />
        </label>
        {isRange && !halfDay && (
          <label className="block">
            <span className="text-sm font-medium">Đến ngày</span>
            <input type="date" name="endDate" defaultValue={today} className={inputClass} />
          </label>
        )}
      </div>

      {HALF_DAY.includes(type) && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="halfDay" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} />
          Nghỉ nửa ngày
        </label>
      )}

      {showTimes && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">{type === "OVERTIME" ? "Bắt đầu" : "Giờ vào"}</span>
            <input type="time" name="checkInTime" className={inputClass} required={type === "OVERTIME"} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{type === "OVERTIME" ? "Kết thúc" : "Giờ ra"}</span>
            <input type="time" name="checkOutTime" className={inputClass} required={type === "OVERTIME"} />
          </label>
        </div>
      )}
      {type === "MISSED_CHECK" && (
        <p className="-mt-2 text-xs text-slate-500">Chỉ nhập giờ bạn quên chấm; để trống giờ đã chấm rồi.</p>
      )}

      <label className="block">
        <span className="text-sm font-medium">Lý do</span>
        <textarea name="reason" required minLength={5} maxLength={500} rows={3} className={inputClass} />
      </label>
    </>
  );
}
