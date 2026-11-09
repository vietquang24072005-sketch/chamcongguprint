import "server-only";
import { db } from "@/lib/db";
import { dateKeyToDb, dbDateToKey, localDateKey } from "@/lib/time";
import { buildMonthlySummary, monthRange, type ApprovedRequest, type MonthlySummary } from "@/lib/reports/summary";

/** "yyyy-MM" hợp lệ hoặc tháng hiện tại. */
export function resolveMonth(value: unknown, now: Date): string {
  if (typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  return localDateKey(now).slice(0, 7);
}

async function loadCalendar() {
  const [config, holidays] = await Promise.all([
    db.appConfig.findUnique({ where: { id: 1 } }),
    db.holiday.findMany(),
  ]);
  return {
    workingWeekdays: config?.workingWeekdays ?? [1, 2, 3, 4, 5],
    holidays: new Map(holidays.map((h) => [dbDateToKey(h.date), h.name])),
  };
}

export type ReportRow = {
  user: {
    id: string;
    employeeCode: string;
    fullName: string;
    active: boolean;
    departmentName: string | null;
    shiftName: string | null;
  };
  summary: MonthlySummary;
};

/**
 * Bảng công tháng. Gồm nhân viên đang làm và nhân viên đã khoá nhưng có dữ liệu công trong tháng.
 */
export async function getMonthlyReport(monthKey: string, departmentId: string | null, now: Date): Promise<ReportRow[]> {
  const { start, end } = monthRange(monthKey);
  const startDb = dateKeyToDb(start);
  const endDb = dateKeyToDb(end);

  const users = await db.user.findMany({
    where: {
      ...(departmentId && { departmentId: departmentId === "none" ? null : departmentId }),
      createdAt: { lte: new Date(`${end}T23:59:59+07:00`) },
      OR: [{ active: true }, { attendances: { some: { workDate: { gte: startDb, lte: endDb } } } }],
    },
    include: { department: { select: { name: true } }, shift: { select: { name: true } } },
    orderBy: { employeeCode: "asc" },
  });
  const ids = users.map((u) => u.id);

  const [calendar, records, requests] = await Promise.all([
    loadCalendar(),
    db.attendance.findMany({ where: { userId: { in: ids }, workDate: { gte: startDb, lte: endDb } } }),
    db.request.findMany({
      where: { userId: { in: ids }, status: "APPROVED", startDate: { lte: endDb }, endDate: { gte: startDb } },
    }),
  ]);

  const today = localDateKey(now);
  return users.map((u) => ({
    user: {
      id: u.id,
      employeeCode: u.employeeCode,
      fullName: u.fullName,
      active: u.active,
      departmentName: u.department?.name ?? null,
      shiftName: u.shift?.name ?? null,
    },
    summary: buildMonthlySummary({
      monthKey,
      today,
      employedFrom: localDateKey(u.createdAt),
      workingWeekdays: calendar.workingWeekdays,
      holidays: calendar.holidays,
      records: records
        .filter((r) => r.userId === u.id)
        .map((r) => ({ ...r, workDate: dbDateToKey(r.workDate) })),
      approvedRequests: requests.filter((r) => r.userId === u.id).map(toApproved),
    }),
  }));
}

function toApproved(r: {
  type: ApprovedRequest["type"];
  startDate: Date;
  endDate: Date;
  halfDay: boolean;
  requestedCheckIn: Date | null;
  requestedCheckOut: Date | null;
}): ApprovedRequest {
  return {
    type: r.type,
    startKey: dbDateToKey(r.startDate),
    endKey: dbDateToKey(r.endDate),
    halfDay: r.halfDay,
    requestedCheckIn: r.requestedCheckIn,
    requestedCheckOut: r.requestedCheckOut,
  };
}

/** Bảng công tháng của một nhân viên, kèm ghi chú từng ngày. */
export async function getEmployeeMonth(userId: string, monthKey: string, now: Date) {
  const { start, end } = monthRange(monthKey);
  const startDb = dateKeyToDb(start);
  const endDb = dateKeyToDb(end);

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { department: { select: { name: true } }, shift: true },
  });
  if (!user) return null;

  const [calendar, records, requests] = await Promise.all([
    loadCalendar(),
    db.attendance.findMany({ where: { userId, workDate: { gte: startDb, lte: endDb } } }),
    db.request.findMany({ where: { userId, status: "APPROVED", startDate: { lte: endDb }, endDate: { gte: startDb } } }),
  ]);

  const summary = buildMonthlySummary({
    monthKey,
    today: localDateKey(now),
    employedFrom: localDateKey(user.createdAt),
    workingWeekdays: calendar.workingWeekdays,
    holidays: calendar.holidays,
    records: records.map((r) => ({ ...r, workDate: dbDateToKey(r.workDate) })),
    approvedRequests: requests.map(toApproved),
  });
  const notes = new Map(records.map((r) => [dbDateToKey(r.workDate), r.note]));
  return { user, summary, notes, today: localDateKey(now) };
}
