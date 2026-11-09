import ExcelJS from "exceljs";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { getMonthlyReport, resolveMonth } from "@/lib/reports/service";
import { DAY_CODE_LABEL, monthRange, type DayCode } from "@/lib/reports/summary";
import { weekdayOf } from "@/lib/requests/rules";
import { db } from "@/lib/db";

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const CODE_FILL: Partial<Record<DayCode, string>> = {
  X: "FFD1FAE5",
  M: "FFFEF3C7",
  S: "FFFEF3C7",
  MS: "FFFFEDD5",
  Q: "FFE0F2FE",
  P: "FFEDE9FE",
  "P/2": "FFEDE9FE",
  KL: "FFFAE8FF",
  "KL/2": "FFFAE8FF",
  CT: "FFCCFBF1",
  V: "FFFFE4E6",
  "V/2": "FFFFE4E6",
  L: "FFE2E8F0",
};

const thin = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const hours = (min: number) => Math.round((min / 60) * 100) / 100;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Chưa đăng nhập", { status: 401 });
  if (!hasRole(user, "HR")) return new Response("Không có quyền", { status: 403 });

  const url = new URL(request.url);
  const now = new Date();
  const month = resolveMonth(url.searchParams.get("month"), now);
  const deptParam = url.searchParams.get("dept");
  const dept = deptParam ? deptParam : null;

  const [rows, deptRow] = await Promise.all([
    getMonthlyReport(month, dept, now),
    dept && dept !== "none" ? db.department.findUnique({ where: { id: dept }, select: { name: true } }) : null,
  ]);
  const [y, m] = month.split("-");
  const scope = dept === "none" ? "Không thuộc phòng ban" : (deptRow?.name ?? "Tất cả phòng ban");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Chấm công online";
  wb.created = now;

  // ───────────── Sheet 1: Tổng hợp ─────────────
  const ws = wb.addWorksheet("Tổng hợp", { views: [{ state: "frozen", ySplit: 4, xSplit: 3 }] });
  const columns: { header: string; key: string; width: number }[] = [
    { header: "STT", key: "stt", width: 5 },
    { header: "Mã NV", key: "code", width: 10 },
    { header: "Họ tên", key: "name", width: 26 },
    { header: "Phòng ban", key: "dept", width: 16 },
    { header: "Công chuẩn", key: "standard", width: 10 },
    { header: "Có mặt", key: "present", width: 9 },
    { header: "Phép năm", key: "annual", width: 9 },
    { header: "Không lương", key: "unpaid", width: 11 },
    { header: "Công tác", key: "trip", width: 9 },
    { header: "Lễ", key: "holiday", width: 6 },
    { header: "Vắng", key: "absent", width: 7 },
    { header: "Số lần muộn", key: "lateCount", width: 11 },
    { header: "Phút muộn", key: "lateMin", width: 10 },
    { header: "Số lần sớm", key: "earlyCount", width: 10 },
    { header: "Phút sớm", key: "earlyMin", width: 9 },
    { header: "Quên check-out", key: "forgot", width: 13 },
    { header: "Giờ làm (giờ)", key: "worked", width: 12 },
    { header: "Tăng ca (giờ)", key: "ot", width: 12 },
    { header: "Công tính lương", key: "paid", width: 14 },
  ];
  ws.columns = columns.map(({ key, width }) => ({ key, width }));

  ws.mergeCells(1, 1, 1, columns.length);
  ws.getCell(1, 1).value = `BẢNG TỔNG HỢP CÔNG THÁNG ${m}/${y}`;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.mergeCells(2, 1, 2, columns.length);
  ws.getCell(2, 1).value = `${scope} · Xuất lúc ${now.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`;
  ws.getCell(2, 1).font = { italic: true, color: { argb: "FF64748B" } };

  const header = ws.getRow(4);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.border = border;
  });
  header.height = 30;

  rows.forEach(({ user: u, summary: s }, i) => {
    const row = ws.addRow({
      stt: i + 1,
      code: u.employeeCode,
      name: u.active ? u.fullName : `${u.fullName} (đã khoá)`,
      dept: u.departmentName ?? "",
      standard: s.standardDays,
      present: s.presentDays,
      annual: s.annualLeaveDays,
      unpaid: s.unpaidLeaveDays,
      trip: s.businessTripDays,
      holiday: s.paidHolidays,
      absent: s.absentDays,
      lateCount: s.lateCount,
      lateMin: s.lateMinutes,
      earlyCount: s.earlyCount,
      earlyMin: s.earlyMinutes,
      forgot: s.missingCheckout,
      worked: hours(s.workedMinutes),
      ot: hours(s.overtimeMinutes),
      paid: s.paidDays,
    });
    row.eachCell({ includeEmpty: true }, (cell) => (cell.border = border));
    row.getCell("paid").font = { bold: true };
  });

  ws.addRow([]);
  const note = ws.addRow(["Công tính lương = Có mặt + Công tác + Phép năm + Lễ. Ngày hôm nay chưa tính vắng."]);
  note.getCell(1).font = { italic: true, color: { argb: "FF64748B" } };

  // ───────────── Sheet 2: Chi tiết theo ngày ─────────────
  const { end } = monthRange(month);
  const dayCount = Number(end.slice(8));
  const wd = wb.addWorksheet("Chấm công chi tiết", { views: [{ state: "frozen", ySplit: 3, xSplit: 2 }] });
  wd.getColumn(1).width = 10;
  wd.getColumn(2).width = 26;
  for (let d = 1; d <= dayCount; d++) wd.getColumn(2 + d).width = 5;

  wd.mergeCells(1, 1, 1, 2 + dayCount);
  wd.getCell(1, 1).value = `CHẤM CÔNG CHI TIẾT THÁNG ${m}/${y} · ${scope}`;
  wd.getCell(1, 1).font = { bold: true, size: 14 };

  const dayRow = wd.getRow(2);
  const wdRow = wd.getRow(3);
  dayRow.getCell(1).value = "Mã NV";
  dayRow.getCell(2).value = "Họ tên";
  for (let d = 1; d <= dayCount; d++) {
    const key = `${month}-${String(d).padStart(2, "0")}`;
    dayRow.getCell(2 + d).value = d;
    wdRow.getCell(2 + d).value = WEEKDAY[weekdayOf(key)];
  }
  for (const r of [dayRow, wdRow]) {
    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      cell.border = border;
    });
  }

  for (const { user: u, summary: s } of rows) {
    const row = wd.addRow([u.employeeCode, u.fullName, ...s.days.map((d) => d.code)]);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = border;
      if (col <= 2) return;
      cell.alignment = { horizontal: "center" };
      const fill = CODE_FILL[s.days[col - 3]?.code ?? ""];
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    });
  }

  wd.addRow([]);
  wd.addRow(["Ký hiệu:"]).getCell(1).font = { bold: true };
  for (const [code, label] of Object.entries(DAY_CODE_LABEL)) {
    const r = wd.addRow([code, label]);
    r.getCell(1).alignment = { horizontal: "center" };
    const fill = CODE_FILL[code as DayCode];
    if (fill) r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `bang-cong-${month}.xlsx`;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
