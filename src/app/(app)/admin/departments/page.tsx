import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Card, inputBase } from "@/components/fields";
import { deleteDepartmentAction, saveDepartmentAction } from "@/app/actions/admin";

export default function DepartmentsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-200" />}>
      <DepartmentsContent />
    </Suspense>
  );
}

async function DepartmentsContent() {
  await requireRole("HR");
  const departments = await db.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: { where: { active: true } } } } },
  });

  return (
    <div className="space-y-6">
      <Card title="Thêm phòng ban">
        <ActionForm action={saveDepartmentAction} submitLabel="Thêm" resetOnSuccess className="flex flex-wrap gap-2">
          <input name="name" required placeholder="Tên phòng ban" className={`${inputBase} max-w-sm flex-1`} />
        </ActionForm>
      </Card>

      <Card title={`Danh sách (${departments.length})`}>
        {departments.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có phòng ban nào.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {departments.map((d) => (
              <li key={d.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="flex-1">
                  <ActionForm
                    action={saveDepartmentAction}
                    submitLabel="Đổi tên"
                    className="flex flex-wrap items-center gap-2"
                    submitClassName="rounded-lg px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                  >
                    <input type="hidden" name="id" value={d.id} />
                    <input name="name" required defaultValue={d.name} className={`${inputBase} max-w-sm flex-1`} />
                    <span className="text-sm text-slate-500">{d._count.users} nhân viên</span>
                  </ActionForm>
                </div>
                <ConfirmButton
                  action={deleteDepartmentAction.bind(null, d.id)}
                  label="Xoá"
                  confirmText={`Xoá phòng ban "${d.name}"?`}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
