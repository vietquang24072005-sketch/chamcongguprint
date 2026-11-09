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
      {/* Màn hình hẹp: menu xuống hàng riêng bên dưới; từ md: nằm giữa logo và tên người dùng */}
      <nav className="order-last flex w-full flex-wrap gap-x-4 gap-y-1 text-sm md:order-none md:w-auto md:flex-1">
        {LINKS.filter((l) => hasRole(user, l.min)).map((l) => (
          <Link key={l.href} href={l.href} className="text-slate-600 hover:text-blue-700">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3 text-sm">
        <Link href="/account" className="text-slate-600 hover:text-blue-700" title="Tài khoản và đổi mật khẩu">
          {user.fullName} · <span className="text-slate-400">{ROLE_LABEL[user.role]}</span>
        </Link>
        <form action={logout}>
          <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">Đăng xuất</button>
        </form>
      </div>
    </>
  );
}
