import { Field, inputClass } from "@/components/fields";
import { ROLE_LABEL } from "@/lib/labels";
import { minutesToHHmm } from "@/lib/time";
import type { Role } from "@/generated/prisma/enums";

type Option = { id: string; name: string };
type ShiftOption = Option & { startMinute: number; endMinute: number };

export type EmployeeDefaults = {
  fullName?: string;
  email?: string;
  employeeCode?: string;
  role?: Role;
  departmentId?: string | null;
  shiftId?: string | null;
  annualLeaveDays?: number;
};

/** Các ô nhập thông tin nhân viên, dùng chung cho form thêm và sửa. */
export function EmployeeFields({
  departments,
  shifts,
  roles,
  defaults = {},
  lockRole = false,
}: {
  departments: Option[];
  shifts: ShiftOption[];
  roles: Role[];
  defaults?: EmployeeDefaults;
  lockRole?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Họ tên">
        <input name="fullName" required defaultValue={defaults.fullName} className={inputClass} />
      </Field>
      <Field label="Mã nhân viên">
        <input name="employeeCode" required defaultValue={defaults.employeeCode} className={`${inputClass} uppercase`} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required defaultValue={defaults.email} className={inputClass} />
      </Field>
      <Field label="Vai trò" hint={lockRole ? "Không thể tự đổi vai trò của mình" : undefined}>
        {lockRole ? (
          <>
            <input type="hidden" name="role" value={defaults.role} />
            <input disabled value={defaults.role ? ROLE_LABEL[defaults.role] : ""} className={`${inputClass} bg-slate-50`} />
          </>
        ) : (
          <select name="role" defaultValue={defaults.role ?? "EMPLOYEE"} className={inputClass}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Phòng ban">
        <select name="departmentId" defaultValue={defaults.departmentId ?? ""} className={inputClass}>
          <option value="">— Không thuộc phòng ban —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Ca làm việc">
        <select name="shiftId" defaultValue={defaults.shiftId ?? ""} className={inputClass}>
          <option value="">— Chưa gán ca —</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({minutesToHHmm(s.startMinute)}–{minutesToHHmm(s.endMinute)})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Số ngày phép năm">
        <input
          name="annualLeaveDays"
          type="number"
          min={0}
          max={60}
          step={0.5}
          required
          defaultValue={defaults.annualLeaveDays ?? 12}
          className={inputClass}
        />
      </Field>
    </div>
  );
}
