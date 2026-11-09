"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/employees", label: "Nhân viên" },
  { href: "/admin/departments", label: "Phòng ban" },
  { href: "/admin/shifts", label: "Ca làm việc" },
  { href: "/admin/holidays", label: "Ngày lễ" },
  { href: "/admin/settings", label: "Cấu hình chấm công", adminOnly: true },
];

export function AdminTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200">
      {TABS.filter((t) => isAdmin || !t.adminOnly).map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
              active ? "border-blue-600 font-medium text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
