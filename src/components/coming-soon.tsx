import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import type { Role } from "@/generated/prisma/enums";

async function Guard({ min, children }: { min: Role; children: React.ReactNode }) {
  await requireRole(min);
  return <>{children}</>;
}

/** Trang tạm cho các tính năng chưa làm. Vẫn kiểm tra quyền ở server. */
export function ComingSoon({ title, min, description }: { title: string; min: Role; description: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <Suspense fallback={null}>
        <Guard min={min}>
          <p className="rounded-2xl bg-white p-6 text-slate-500 ring-1 ring-slate-200">
            Đang phát triển. {description}
          </p>
        </Guard>
      </Suspense>
    </div>
  );
}
