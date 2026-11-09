import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/labels";
import { minutesToHHmm } from "@/lib/time";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputClass } from "@/components/fields";
import { changeOwnPasswordAction } from "@/app/actions/account";

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tài khoản</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-200" />}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

async function AccountContent() {
  const me = await requireUser();
  const user = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    include: { department: { select: { name: true } }, shift: true },
  });

  const info: [string, string][] = [
    ["Họ tên", user.fullName],
    ["Mã nhân viên", user.employeeCode],
    ["Email", user.email],
    ["Vai trò", ROLE_LABEL[user.role]],
    ["Phòng ban", user.department?.name ?? "—"],
    [
      "Ca làm việc",
      user.shift
        ? `${user.shift.name} (${minutesToHHmm(user.shift.startMinute)}–${minutesToHHmm(user.shift.endMinute)})`
        : "Chưa gán",
    ],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Thông tin">
        <dl className="space-y-2 text-sm">
          {info.map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-slate-500">Cần sửa thông tin? Liên hệ bộ phận Nhân sự.</p>
      </Card>

      <Card title="Đổi mật khẩu">
        <ActionForm action={changeOwnPasswordAction} submitLabel="Đổi mật khẩu" resetOnSuccess>
          <Field label="Mật khẩu hiện tại">
            <input name="currentPassword" type="password" required autoComplete="current-password" className={inputClass} />
          </Field>
          <Field label="Mật khẩu mới" hint="Tối thiểu 8 ký tự.">
            <input name="newPassword" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
          </Field>
          <Field label="Nhập lại mật khẩu mới">
            <input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
          </Field>
        </ActionForm>
      </Card>
    </div>
  );
}
