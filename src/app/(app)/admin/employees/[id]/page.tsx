import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAssignRole, canManageUser } from "@/lib/admin/rules";
import { ROLE_LABEL } from "@/lib/labels";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputClass } from "@/components/fields";
import { resetPasswordAction, updateUserAction } from "@/app/actions/admin";
import type { Role } from "@/generated/prisma/enums";
import { EmployeeFields } from "../employee-fields";

const ALL_ROLES: Role[] = ["EMPLOYEE", "MANAGER", "HR", "ADMIN"];

export default function EditEmployeePage({ params }: PageProps<"/admin/employees/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}>
      <EditEmployee params={params} />
    </Suspense>
  );
}

async function EditEmployee({ params }: { params: PageProps<"/admin/employees/[id]">["params"] }) {
  const actor = await requireRole("HR");
  const { id } = await params;

  const [user, departments, shifts] = await Promise.all([
    db.user.findUnique({ where: { id } }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.shift.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, startMinute: true, endMinute: true } }),
  ]);
  if (!user) notFound();

  const back = (
    <Link href="/admin/employees" className="text-sm text-blue-700 hover:underline">
      ← Danh sách nhân viên
    </Link>
  );

  if (!canManageUser(actor, user)) {
    return (
      <div className="space-y-4">
        {back}
        <Card title={`${user.fullName} (${user.employeeCode})`}>
          <p className="text-sm text-slate-600">
            Tài khoản {ROLE_LABEL[user.role]} chỉ Quản trị viên được chỉnh sửa.
          </p>
        </Card>
      </div>
    );
  }

  const isSelf = actor.id === user.id;
  const roles = ALL_ROLES.filter((r) => canAssignRole(actor, r));

  return (
    <div className="space-y-6">
      {back}
      <Card title={`${user.fullName} (${user.employeeCode})`}>
        <ActionForm action={updateUserAction} submitLabel="Lưu thay đổi">
          <input type="hidden" name="id" value={user.id} />
          <EmployeeFields
            departments={departments}
            shifts={shifts}
            roles={roles}
            lockRole={isSelf}
            defaults={{ ...user, annualLeaveDays: Number(user.annualLeaveDays) }}
          />
          {isSelf ? (
            <input type="hidden" name="active" value="on" />
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={user.active} />
              Đang làm việc (bỏ chọn để khoá tài khoản — nhân viên sẽ không đăng nhập được)
            </label>
          )}
        </ActionForm>
      </Card>

      <Card title="Đặt lại mật khẩu">
        <ActionForm action={resetPasswordAction} submitLabel="Đặt lại mật khẩu" resetOnSuccess>
          <input type="hidden" name="id" value={user.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mật khẩu mới" hint="Tối thiểu 8 ký tự.">
              <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
            </Field>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
