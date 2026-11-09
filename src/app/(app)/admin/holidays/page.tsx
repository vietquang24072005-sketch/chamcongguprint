import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbDateToKey, formatDateKey, localDateKey } from "@/lib/time";
import { weekdayOf } from "@/lib/requests/rules";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Card, Field, inputClass } from "@/components/fields";
import { createHolidayAction, deleteHolidayAction } from "@/app/actions/admin";

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function HolidaysPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-200" />}>
      <HolidaysContent />
    </Suspense>
  );
}

async function HolidaysContent() {
  await requireRole("HR");
  const today = localDateKey(new Date());
  const year = Number(today.slice(0, 4));
  const holidays = await db.holiday.findMany({
    where: { date: { gte: new Date(`${year - 1}-01-01T00:00:00Z`) } },
    orderBy: { date: "asc" },
  });

  const byYear = new Map<number, typeof holidays>();
  for (const h of holidays) {
    const y = h.date.getUTCFullYear();
    byYear.set(y, [...(byYear.get(y) ?? []), h]);
  }

  return (
    <div className="space-y-6">
      <Card title="Thêm ngày lễ">
        <ActionForm action={createHolidayAction} submitLabel="Thêm" resetOnSuccess className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <Field label="Ngày">
            <input name="date" type="date" required className={inputClass} />
          </Field>
          <Field label="Tên">
            <input name="name" required placeholder="Vd. Tết Nguyên đán" className={inputClass} />
          </Field>
        </ActionForm>
        <p className="mt-3 text-xs text-slate-500">
          Tết Nguyên đán và Giỗ Tổ Hùng Vương đổi ngày theo năm — nhập từng ngày theo thông báo nghỉ chính thức. Ngày lễ
          không tính vắng mặt và không trừ phép.
        </p>
      </Card>

      {[...byYear.entries()]
        .sort(([a], [b]) => b - a)
        .map(([y, list]) => (
          <Card key={y} title={`Năm ${y} (${list.length} ngày)`}>
            <ul className="divide-y divide-slate-100">
              {list.map((h) => {
                const key = dbDateToKey(h.date);
                return (
                  <li key={h.id} className={`flex items-center gap-3 py-2 ${key < today ? "text-slate-400" : ""}`}>
                    <span className="w-28 tabular-nums">
                      {WEEKDAY[weekdayOf(key)]} {formatDateKey(key)}
                    </span>
                    <span className="flex-1">{h.name}</span>
                    <ConfirmButton
                      action={deleteHolidayAction.bind(null, h.id)}
                      label="Xoá"
                      confirmText={`Xoá ngày lễ "${h.name}" (${formatDateKey(key)})?`}
                    />
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      {byYear.size === 0 && <p className="text-sm text-slate-500">Chưa có ngày lễ nào.</p>}
    </div>
  );
}
