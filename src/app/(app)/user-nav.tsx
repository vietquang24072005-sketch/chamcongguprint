import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { hasRole, requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import type { Role } from "@/generated/prisma/enums";

const LINKS: { href: string; label: string; min: Role }[] = [
  { href: "/dashboard", label: "Hôm nay", min: "EMPLOYEE" },
  { href: "/attendance", label: "Lịch sử công", min: "EMPLOYEE" },
  { href: "/requests", label: "Đơn từ", min: "EMPLOYEE" },
  { href: "/approvals", label: "Duyệt đơn", min: "MANAGER" },
  { href: "/reports", label: "Báo cáo", min: "HR" },
  { href: "/admin", label: "Quản trị", min: "HR" },
];

export async function UserNav() {
  const user = await requireUser();
  return (
    <>
      <nav className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
        {LINKS.filter((l) => hasRole(user, l.min)).map((l) => (
          <Link key={l.href} href={l.href} className="text-slate-600 hover:text-blue-700">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-600">
          {user.fullName} · <span className="text-slate-400">{ROLE_LABEL[user.role]}</span>
        </span>
        <form action={logout}>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">Đăng xuất</button>
        </form>
      </div>
    </>
  );
}
