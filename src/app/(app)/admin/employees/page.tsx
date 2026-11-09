import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAssignRole } from "@/lib/admin/rules";
import { ROLE_LABEL } from "@/lib/labels";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputBase, inputClass } from "@/components/fields";
import { createUserAction } from "@/app/actions/admin";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { EmployeeFields } from "./employee-fields";

const ALL_ROLES: Role[] = ["EMPLOYEE", "MANAGER", "HR", "ADMIN"];

export default function EmployeesPage({ searchParams }: PageProps<"/admin/employees">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}>
      <EmployeesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function EmployeesContent({ searchParams }: { searchParams: PageProps<"/admin/employees">["searchParams"] }) {
  const actor = await requireRole("HR");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const dept = typeof sp.dept === "string" ? sp.dept : "";
  const status = sp.status === "inactive" ? "inactive" : sp.status === "all" ? "all" : "active";

  const where: Prisma.UserWhereInput = {
    ...(q && {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { employeeCode: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(dept && { departmentId: dept === "none" ? null : dept }),
    ...(status !== "all" && { active: status === "active" }),
  };

  const [users, departments, shifts] = await Promise.all([
    db.user.findMany({
      where,
      include: { department: { select: { name: true } }, shift: { select: { name: true } } },
      orderBy: { employeeCode: "asc" },
      take: 200,
    }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.shift.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, startMinute: true, endMinute: true } }),
  ]);
  const roles = ALL_ROLES.filter((r) => canAssignRole(actor, r));

  return (
    <div className="space-y-6">
      <Card>
        <details>
          <summary className="cursor-pointer font-semibold text-blue-700">+ Thêm nhân viên</summary>
          <div className="mt-4">
            <ActionForm action={createUserAction} submitLabel="Tạo tài khoản" resetOnSuccess>
              <EmployeeFields departments={departments} shifts={shifts} roles={roles} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Mật khẩu ban đầu" hint="Tối thiểu 8 ký tự. Gửi cho nhân viên qua kênh riêng.">
                  <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
                </Field>
              </div>
            </ActionForm>
          </div>
        </details>
      </Card>

      <Card>
        <form className="mb-4 flex flex-wrap items-end gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Tìm theo tên, email, mã NV"
            className={`${inputBase} w-full sm:w-64`}
          />
          <select name="dept" defaultValue={dept} className={inputBase}>
            <option value="">Mọi phòng ban</option>
            <option value="none">Không thuộc phòng ban</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status} className={inputBase}>
            <option value="active">Đang làm</option>
            <option value="inactive">Đã khoá</option>
            <option value="all">Tất cả</option>
          </select>
          <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700">Lọc</button>
        </form>

        {users.length === 0 ? (
          <p className="text-sm text-slate-500">Không có nhân viên nào khớp.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-3 font-medium">Mã</th>
                  <th className="py-2 pr-3 font-medium">Họ tên</th>
                  <th className="py-2 pr-3 font-medium">Phòng ban</th>
                  <th className="py-2 pr-3 font-medium">Ca</th>
                  <th className="py-2 pr-3 font-medium">Vai trò</th>
                  <th className="py-2 pr-3 font-medium">Phép</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className={u.active ? "" : "text-slate-400"}>
                    <td className="py-2 pr-3 font-mono text-xs">{u.employeeCode}</td>
                    <td className="py-2 pr-3">
                      <div>{u.fullName}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>
                    <td className="py-2 pr-3">{u.department?.name ?? "—"}</td>
                    <td className="py-2 pr-3">{u.shift?.name ?? <span className="text-amber-700">Chưa gán</span>}</td>
                    <td className="py-2 pr-3">
                      {ROLE_LABEL[u.role]}
                      {!u.active && <span className="ml-1 rounded bg-slate-100 px-1.5 text-xs">Đã khoá</span>}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{Number(u.annualLeaveDays)}</td>
                    <td className="py-2 text-right">
                      <Link href={`/admin/employees/${u.id}`} className="text-blue-700 hover:underline">
                        Sửa
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
