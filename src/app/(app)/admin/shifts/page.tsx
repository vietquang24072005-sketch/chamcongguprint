import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { isOvernight } from "@/lib/attendance/compute";
import { minutesToHHmm } from "@/lib/time";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Card, Field, inputClass } from "@/components/fields";
import { deleteShiftAction, saveShiftAction } from "@/app/actions/admin";

export default function ShiftsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-200" />}>
      <ShiftsContent />
    </Suspense>
  );
}

type ShiftDefaults = {
  id?: string;
  name?: string;
  startMinute?: number;
  endMinute?: number;
  breakStartMinute?: number | null;
  breakEndMinute?: number | null;
  lateGraceMinutes?: number;
  earlyGraceMinutes?: number;
};

function ShiftFields({ s = {} }: { s?: ShiftDefaults }) {
  const t = (m: number | null | undefined) => (m == null ? "" : minutesToHHmm(m));
  return (
    <>
      {s.id && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-4">
          <Field label="Tên ca">
            <input name="name" required defaultValue={s.name} className={inputClass} />
          </Field>
        </div>
        <Field label="Bắt đầu">
          <input name="start" type="time" required defaultValue={t(s.startMinute) || "08:00"} className={inputClass} />
        </Field>
        <Field label="Kết thúc" hint="Nhỏ hơn giờ bắt đầu = ca qua đêm">
          <input name="end" type="time" required defaultValue={t(s.endMinute) || "17:00"} className={inputClass} />
        </Field>
        <Field label="Nghỉ từ" hint="Để trống nếu không nghỉ">
          <input name="breakStart" type="time" defaultValue={t(s.breakStartMinute)} className={inputClass} />
        </Field>
        <Field label="Nghỉ đến">
          <input name="breakEnd" type="time" defaultValue={t(s.breakEndMinute)} className={inputClass} />
        </Field>
        <Field label="Cho phép muộn (phút)">
          <input
            name="lateGraceMinutes"
            type="number"
            min={0}
            max={120}
            required
            defaultValue={s.lateGraceMinutes ?? 5}
            className={inputClass}
          />
        </Field>
        <Field label="Cho phép về sớm (phút)">
          <input
            name="earlyGraceMinutes"
            type="number"
            min={0}
            max={120}
            required
            defaultValue={s.earlyGraceMinutes ?? 5}
            className={inputClass}
          />
        </Field>
      </div>
    </>
  );
}

async function ShiftsContent() {
  await requireRole("HR");
  const shifts = await db.shift.findMany({
    orderBy: { startMinute: "asc" },
    include: { _count: { select: { users: { where: { active: true } } } } },
  });

  return (
    <div className="space-y-6">
      <Card>
        <details>
          <summary className="cursor-pointer font-semibold text-blue-700">+ Thêm ca làm việc</summary>
          <div className="mt-4">
            <ActionForm action={saveShiftAction} submitLabel="Thêm ca" resetOnSuccess>
              <ShiftFields />
            </ActionForm>
          </div>
        </details>
      </Card>

      {shifts.map((s) => (
        <Card
          key={s.id}
          title={`${s.name} · ${minutesToHHmm(s.startMinute)}–${minutesToHHmm(s.endMinute)}${isOvernight(s) ? " (qua đêm)" : ""}`}
          actions={
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{s._count.users} nhân viên</span>
              <ConfirmButton action={deleteShiftAction.bind(null, s.id)} label="Xoá" confirmText={`Xoá ca "${s.name}"?`} />
            </div>
          }
        >
          <p className="mb-3 text-xs text-amber-700">
            Sửa giờ ca chỉ áp dụng cho các lần chấm công từ nay về sau, không tính lại công đã ghi.
          </p>
          <ActionForm action={saveShiftAction} submitLabel="Lưu ca">
            <ShiftFields s={s} />
          </ActionForm>
        </Card>
      ))}
    </div>
  );
}
