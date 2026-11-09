import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMonthlyReport, resolveMonth } from "@/lib/reports/service";
import { formatMinutes } from "@/lib/reports/summary";
import { Card, inputBase } from "@/components/fields";
import { DayCodeLegend } from "@/components/day-code";

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Bảng công tháng</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-200" />}>
        <ReportContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

async function ReportContent({ searchParams }: { searchParams: PageProps<"/reports">["searchParams"] }) {
  await requireRole("HR");
  const sp = await searchParams;
  const now = new Date();
  const month = resolveMonth(sp.month, now);
  const dept = typeof sp.dept === "string" && sp.dept ? sp.dept : null;

  const [rows, departments] = await Promise.all([
    getMonthlyReport(month, dept, now),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const exportParams = new URLSearchParams({ month, ...(dept && { dept }) });

  return (
    <div className="space-y-6">
      <Card>
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block font-medium">Tháng</span>
            <input type="month" name="month" defaultValue={month} className={`${inputBase} mt-1`} />
          </label>
          <label className="text-sm">
            <span className="block font-medium">Phòng ban</span>
            <select name="dept" defaultValue={dept ?? ""} className={`${inputBase} mt-1`}>
              <option value="">Tất cả</option>
              <option value="none">Không thuộc phòng ban</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700">Xem</button>
          <a
            href={`/reports/export?${exportParams}`}
            className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Xuất Excel
          </a>
        </form>
      </Card>

      <Card title={`Tổng hợp ${month.slice(5)}/${month.slice(0, 4)} · ${rows.length} nhân viên`}>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">Không có nhân viên nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="text-left text-xs text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-3 font-medium">Nhân viên</th>
                  <th className="px-2 py-2 text-right font-medium" title="Ngày công chuẩn">Chuẩn</th>
                  <th className="px-2 py-2 text-right font-medium">Có mặt</th>
                  <th className="px-2 py-2 text-right font-medium">Phép</th>
                  <th className="px-2 py-2 text-right font-medium" title="Nghỉ không lương">KL</th>
                  <th className="px-2 py-2 text-right font-medium" title="Công tác">CT</th>
                  <th className="px-2 py-2 text-right font-medium">Lễ</th>
                  <th className="px-2 py-2 text-right font-medium">Vắng</th>
                  <th className="px-2 py-2 text-right font-medium" title="Số lần / tổng phút">Muộn</th>
                  <th className="px-2 py-2 text-right font-medium" title="Số lần / tổng phút">Sớm</th>
                  <th className="px-2 py-2 text-right font-medium" title="Quên check-out">Quên</th>
                  <th className="px-2 py-2 text-right font-medium">Giờ làm</th>
                  <th className="px-2 py-2 text-right font-medium">Tăng ca</th>
                  <th className="py-2 pl-2 text-right font-medium" title="Có mặt + công tác + phép + lễ">Công tính lương</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {rows.map(({ user: u, summary: s }) => (
                  <tr key={u.id} className={u.active ? "" : "text-slate-400"}>
                    <td className="py-2 pr-3">
                      <Link href={`/reports/${u.id}?month=${month}`} className="text-blue-700 hover:underline">
                        {u.fullName}
                      </Link>
                      <div className="text-xs text-slate-400">
                        {u.employeeCode}
                        {u.departmentName && ` · ${u.departmentName}`}
                        {!u.active && " · đã khoá"}
                      </div>
                    </td>
                    <td className="px-2 text-right">{num(s.standardDays)}</td>
                    <td className="px-2 text-right">{num(s.presentDays)}</td>
                    <td className="px-2 text-right">{num(s.annualLeaveDays) === "0" ? "" : num(s.annualLeaveDays)}</td>
                    <td className="px-2 text-right">{s.unpaidLeaveDays ? num(s.unpaidLeaveDays) : ""}</td>
                    <td className="px-2 text-right">{s.businessTripDays || ""}</td>
                    <td className="px-2 text-right">{s.paidHolidays || ""}</td>
                    <td className={`px-2 text-right ${s.absentDays ? "font-medium text-rose-700" : ""}`}>
                      {s.absentDays ? num(s.absentDays) : ""}
                    </td>
                    <td className="px-2 text-right">{s.lateCount ? `${s.lateCount} / ${formatMinutes(s.lateMinutes)}` : ""}</td>
                    <td className="px-2 text-right">{s.earlyCount ? `${s.earlyCount} / ${formatMinutes(s.earlyMinutes)}` : ""}</td>
                    <td className="px-2 text-right">{s.missingCheckout || ""}</td>
                    <td className="px-2 text-right">{formatMinutes(s.workedMinutes)}</td>
                    <td className="px-2 text-right">{s.overtimeMinutes ? formatMinutes(s.overtimeMinutes) : ""}</td>
                    <td className="py-2 pl-2 text-right font-semibold">{num(s.paidDays)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Ngày hôm nay chưa tính vắng. Bấm tên nhân viên để xem từng ngày và sửa công.
        </p>
      </Card>

      <Card title="Ký hiệu (dùng trong file Excel)">
        <DayCodeLegend />
      </Card>
    </div>
  );
}
