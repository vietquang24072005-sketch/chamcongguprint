import { Suspense } from "react";
import { hasRole, requireRole } from "@/lib/auth";
import { AdminTabs } from "./admin-tabs";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản trị</h1>
      <Suspense fallback={<div className="h-9" />}>
        <Tabs />
      </Suspense>
      {children}
    </div>
  );
}

async function Tabs() {
  const user = await requireRole("HR");
  return <AdminTabs isAdmin={hasRole(user, "ADMIN")} />;
}
