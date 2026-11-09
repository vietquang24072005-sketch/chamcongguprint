import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { hasRole } from "@/lib/auth";
import { computeAttendance, shiftWindow, type ShiftRule } from "@/lib/attendance/compute";
import type { CreateRequestInput } from "@/lib/validations/request";
import { dateKeyToDb, dbDateToKey, localDateKey, localMinuteToInstant } from "@/lib/time";
import {
  appendNote,
  canApprove,
  countLeaveDays,
  isRangeType,
  leaveDaysInYear,
  rangesOverlap,
  workingDaysInRange,
} from "@/lib/requests/rules";
import type { Prisma } from "@/generated/prisma/client";
import type { AttendanceStatus } from "@/generated/prisma/enums";

import type { ActionResult } from "@/lib/form-state";
export type { ActionResult };

type Tx = Prisma.TransactionClient;

// ───────────────────────── Cấu hình lịch ─────────────────────────

async function loadCalendar(client: Tx | typeof db = db) {
  const [config, holidays] = await Promise.all([
    client.appConfig.findUnique({ where: { id: 1 } }),
    client.holiday.findMany({ select: { date: true } }),
  ]);
  return {
    workingWeekdays: config?.workingWeekdays ?? [1, 2, 3, 4, 5],
    holidays: new Set(holidays.map((h) => dbDateToKey(h.date))),
  };
}

const LEAVE_LIKE = ["ANNUAL_LEAVE", "UNPAID_LEAVE", "BUSINESS_TRIP"] as const;

// ───────────────────────── Quỹ phép ─────────────────────────

export async function getLeaveBalance(userId: string, year: number) {
  const [user, requests, calendar] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { annualLeaveDays: true } }),
    db.request.findMany({
      where: { userId, type: "ANNUAL_LEAVE", status: { in: ["PENDING", "APPROVED"] } },
      select: { startDate: true, endDate: true, halfDay: true, status: true },
    }),
    loadCalendar(),
  ]);
  const toRange = (r: (typeof requests)[number]) => ({
    startKey: dbDateToKey(r.startDate),
    endKey: dbDateToKey(r.endDate),
    halfDay: r.halfDay,
  });
  const used = leaveDaysInYear(
    requests.filter((r) => r.status === "APPROVED").map(toRange),
    year,
    calendar.workingWeekdays,
    calendar.holidays,
  );
  const pending = leaveDaysInYear(
    requests.filter((r) => r.status === "PENDING").map(toRange),
    year,
    calendar.workingWeekdays,
    calendar.holidays,
  );
  const total = Number(user.annualLeaveDays);
  return { total, used, pending, remaining: total - used - pending };
}

// ───────────────────────── Tạo đơn ─────────────────────────

export async function createRequest(user: CurrentUser, input: CreateRequestInput, now: Date): Promise<ActionResult> {
  const today = localDateKey(now);
  const { type, startDate, endDate, halfDay } = input;

  if (type === "MISSED_CHECK" && startDate > today) {
    return { ok: false, error: "Không thể bổ sung chấm công cho ngày trong tương lai" };
  }

  const calendar = await loadCalendar();

  if (isRangeType(type)) {
    const days = countLeaveDays({ startKey: startDate, endKey: endDate, halfDay }, calendar.workingWeekdays, calendar.holidays);
    if (days === 0) return { ok: false, error: "Khoảng ngày đã chọn không có ngày làm việc nào" };

    // Không cho trùng với đơn nghỉ/công tác khác đang chờ hoặc đã duyệt.
    const others = await db.request.findMany({
      where: {
        userId: user.id,
        type: { in: [...LEAVE_LIKE] },
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: dateKeyToDb(endDate) },
        endDate: { gte: dateKeyToDb(startDate) },
      },
      select: { startDate: true, endDate: true, halfDay: true },
    });
    const conflict = others.some(
      (o) =>
        rangesOverlap(startDate, endDate, dbDateToKey(o.startDate), dbDateToKey(o.endDate)) &&
        !(halfDay && o.halfDay), // cho phép 2 đơn nửa ngày cùng một ngày (sáng + chiều)
    );
    if (conflict) return { ok: false, error: "Đã có đơn nghỉ/công tác khác trùng khoảng ngày này" };

    if (type === "ANNUAL_LEAVE") {
      // Kiểm tra quỹ phép theo từng năm mà đơn chạm tới.
      const years = new Set([Number(startDate.slice(0, 4)), Number(endDate.slice(0, 4))]);
      for (const year of years) {
        const balance = await getLeaveBalance(user.id, year);
        const need = leaveDaysInYear(
          [{ startKey: startDate, endKey: endDate, halfDay }],
          year,
          calendar.workingWeekdays,
          calendar.holidays,
        );
        if (need > balance.remaining) {
          return {
            ok: false,
            error: `Không đủ phép năm ${year}: cần ${need} ngày, còn ${balance.remaining} ngày (đã tính đơn đang chờ)`,
          };
        }
      }
    }
  }

  const requestedCheckIn = input.checkInTime ? localMinuteToInstant(startDate, hhmmToMinute(input.checkInTime)) : null;
  let requestedCheckOut = input.checkOutTime ? localMinuteToInstant(startDate, hhmmToMinute(input.checkOutTime)) : null;
  // Giờ ra nhỏ hơn giờ vào → sang ngày hôm sau (ca đêm / tăng ca qua đêm).
  if (requestedCheckIn && requestedCheckOut && requestedCheckOut <= requestedCheckIn) {
    requestedCheckOut = new Date(requestedCheckOut.getTime() + 24 * 60 * 60 * 1000);
  }

  await db.request.create({
    data: {
      userId: user.id,
      type,
      startDate: dateKeyToDb(startDate),
      endDate: dateKeyToDb(endDate),
      halfDay,
      requestedCheckIn,
      requestedCheckOut,
      reason: input.reason,
    },
  });
  return { ok: true, message: "Đã gửi đơn, chờ duyệt" };
}

function hhmmToMinute(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// ───────────────────────── Áp dụng vào bảng công ─────────────────────────

const SNAPSHOT_SELECT = {
  checkInAt: true,
  checkOutAt: true,
  status: true,
  lateMinutes: true,
  earlyMinutes: true,
  workedMinutes: true,
  note: true,
} as const;

type AttendanceSnapshot = {
  checkInAt: Date | null;
  checkOutAt: Date | null;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyMinutes: number;
  workedMinutes: number;
  note: string | null;
};

type StoredSnapshot = { userId: string; workDate: string; record: Record<string, unknown> | null };

function serializeSnapshot(s: AttendanceSnapshot | null): Record<string, unknown> | null {
  if (!s) return null;
  return { ...s, checkInAt: s.checkInAt?.toISOString() ?? null, checkOutAt: s.checkOutAt?.toISOString() ?? null };
}

function deserializeSnapshot(r: Record<string, unknown>): AttendanceSnapshot {
  return {
    checkInAt: r.checkInAt ? new Date(String(r.checkInAt)) : null,
    checkOutAt: r.checkOutAt ? new Date(String(r.checkOutAt)) : null,
    status: r.status as AttendanceStatus,
    lateMinutes: Number(r.lateMinutes),
    earlyMinutes: Number(r.earlyMinutes),
    workedMinutes: Number(r.workedMinutes),
    note: (r.note as string | null) ?? null,
  };
}

function fullShiftMinutes(workDate: string, shift: ShiftRule | null): number {
  if (!shift) return 8 * 60;
  const { start, end } = shiftWindow(workDate, shift);
  return computeAttendance({ workDate, shift, checkInAt: start, checkOutAt: end }).workedMinutes;
}

type RequestWithOwner = Prisma.RequestGetPayload<{ include: { user: { include: { shift: true } } } }>;

/** Ghi tác động của đơn lên bảng công, trả về ảnh chụp trạng thái cũ để hoàn tác. */
async function applyRequest(tx: Tx, req: RequestWithOwner): Promise<StoredSnapshot[]> {
  const userId = req.userId;
  const shift = req.user.shift;
  const startKey = dbDateToKey(req.startDate);
  const endKey = dbDateToKey(req.endDate);
  const snapshots: StoredSnapshot[] = [];

  async function write(workDate: string, build: (current: AttendanceSnapshot | null) => AttendanceSnapshot) {
    const where = { userId_workDate: { userId, workDate: dateKeyToDb(workDate) } };
    const current = await tx.attendance.findUnique({ where, select: SNAPSHOT_SELECT });
    snapshots.push({ userId, workDate, record: serializeSnapshot(current) });
    const next = build(current);
    await tx.attendance.upsert({
      where,
      create: { userId, workDate: dateKeyToDb(workDate), ...next },
      update: next,
    });
  }

  const empty: AttendanceSnapshot = {
    checkInAt: null,
    checkOutAt: null,
    status: "ABSENT",
    lateMinutes: 0,
    earlyMinutes: 0,
    workedMinutes: 0,
    note: null,
  };

  switch (req.type) {
    case "ANNUAL_LEAVE":
    case "UNPAID_LEAVE": {
      const calendar = await loadCalendar(tx);
      const label = req.type === "ANNUAL_LEAVE" ? "phép năm" : "không lương";
      const note = req.halfDay ? `Nghỉ nửa ngày (${label})` : `Nghỉ ${label}`;
      for (const day of workingDaysInRange(startKey, endKey, calendar.workingWeekdays, calendar.holidays)) {
        await write(day, (cur) => {
          const base = cur ?? empty;
          // Đã có chấm công trong ngày (vd. nghỉ nửa ngày) → giữ dữ liệu chấm, chỉ thêm ghi chú.
          if (base.checkInAt) return { ...base, note: appendNote(base.note, note) };
          return { ...base, status: "ON_LEAVE", note: appendNote(base.note, note) };
        });
      }
      break;
    }
    case "BUSINESS_TRIP": {
      const calendar = await loadCalendar(tx);
      for (const day of workingDaysInRange(startKey, endKey, calendar.workingWeekdays, calendar.holidays)) {
        await write(day, (cur) => {
          const base = cur ?? empty;
          return {
            ...base,
            status: "PRESENT",
            lateMinutes: 0,
            earlyMinutes: 0,
            workedMinutes: Math.max(base.workedMinutes, fullShiftMinutes(day, shift)),
            note: appendNote(base.note, "Công tác"),
          };
        });
      }
      break;
    }
    case "MISSED_CHECK": {
      await write(startKey, (cur) => {
        const base = cur ?? empty;
        const checkInAt = req.requestedCheckIn ?? base.checkInAt;
        const checkOutAt = req.requestedCheckOut ?? base.checkOutAt;
        if (!checkInAt) {
          // Chỉ bổ sung giờ ra mà không có giờ vào: ghi nhận giờ ra, chưa tính được công.
          return { ...base, checkOutAt, note: appendNote(base.note, "Bổ sung chấm công") };
        }
        const computed = shift
          ? computeAttendance({ workDate: startKey, shift, checkInAt, checkOutAt })
          : {
              status: checkOutAt ? ("PRESENT" as const) : ("MISSING_CHECKOUT" as const),
              lateMinutes: 0,
              earlyMinutes: 0,
              workedMinutes: checkOutAt ? Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60000) : 0,
            };
        return { ...base, checkInAt, checkOutAt, ...computed, note: appendNote(base.note, "Bổ sung chấm công") };
      });
      break;
    }
    case "LATE_EARLY": {
      await write(startKey, (cur) => {
        const base = cur ?? empty;
        if (!base.checkInAt) return { ...base, note: appendNote(base.note, "Có đơn đi muộn/về sớm") };
        return {
          ...base,
          lateMinutes: 0,
          earlyMinutes: 0,
          status: base.checkOutAt ? "PRESENT" : "MISSING_CHECKOUT",
          note: appendNote(base.note, "Đi muộn/về sớm có phép"),
        };
      });
      break;
    }
    case "OVERTIME":
      // Tăng ca chỉ ghi nhận trên đơn; báo cáo sẽ cộng giờ từ các đơn đã duyệt.
      break;
  }
  return snapshots;
}

async function revertSnapshots(tx: Tx, snapshots: StoredSnapshot[]) {
  // Hoàn tác theo thứ tự ngược lại.
  for (const s of [...snapshots].reverse()) {
    const where = { userId_workDate: { userId: s.userId, workDate: dateKeyToDb(s.workDate) } };
    if (s.record === null) {
      // Bản ghi do chính đơn này tạo ra → xoá để về trạng thái trước khi duyệt.
      await tx.attendance.deleteMany({ where: { userId: s.userId, workDate: dateKeyToDb(s.workDate) } });
    } else {
      await tx.attendance.update({ where, data: deserializeSnapshot(s.record) });
    }
  }
}

// ───────────────────────── Duyệt / từ chối ─────────────────────────

export async function decideRequest(
  actor: CurrentUser,
  requestId: string,
  decision: "APPROVE" | "REJECT",
  note: string | undefined,
  now: Date,
): Promise<ActionResult> {
  if (!hasRole(actor, "MANAGER")) return { ok: false, error: "Bạn không có quyền duyệt đơn" };

  try {
    return await db.$transaction(async (tx) => {
      const req = await tx.request.findUnique({
        where: { id: requestId },
        include: { user: { include: { shift: true } } },
      });
      if (!req) return { ok: false, error: "Không tìm thấy đơn" } as const;
      if (!canApprove(actor, req.user)) return { ok: false, error: "Bạn không có quyền duyệt đơn này" } as const;
      if (req.status !== "PENDING") return { ok: false, error: "Đơn đã được xử lý trước đó" } as const;

      // Khoá lạc quan: chỉ cập nhật nếu đơn vẫn đang chờ.
      const updated = await tx.request.updateMany({
        where: { id: req.id, status: "PENDING" },
        data: {
          status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          approverId: actor.id,
          decidedAt: now,
          decisionNote: note ?? null,
        },
      });
      if (updated.count !== 1) return { ok: false, error: "Đơn đã được xử lý trước đó" } as const;

      if (decision === "APPROVE") {
        const snapshots = await applyRequest(tx, req);
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            entity: "request",
            entityId: req.id,
            action: "approve",
            before: snapshots as unknown as Prisma.InputJsonValue,
            reason: note ?? null,
          },
        });
        return { ok: true, message: "Đã duyệt đơn" } as const;
      }

      await tx.auditLog.create({
        data: { actorId: actor.id, entity: "request", entityId: req.id, action: "reject", reason: note ?? null },
      });
      return { ok: true, message: "Đã từ chối đơn" } as const;
    });
  } catch (e) {
    console.error("decideRequest failed", e);
    return { ok: false, error: "Không xử lý được đơn, vui lòng thử lại" };
  }
}

// ───────────────────────── Huỷ đơn ─────────────────────────

/**
 * - Người gửi được huỷ đơn đang chờ của mình.
 * - HR/ADMIN được huỷ đơn đã duyệt: bảng công được hoàn tác về trạng thái trước khi duyệt.
 */
export async function cancelRequest(
  actor: CurrentUser,
  requestId: string,
  reason: string | undefined,
  now: Date,
): Promise<ActionResult> {
  try {
    return await db.$transaction(async (tx) => {
      const req = await tx.request.findUnique({ where: { id: requestId } });
      if (!req) return { ok: false, error: "Không tìm thấy đơn" } as const;

      if (req.status === "PENDING") {
        if (req.userId !== actor.id) return { ok: false, error: "Bạn chỉ huỷ được đơn của mình" } as const;
        const updated = await tx.request.updateMany({
          where: { id: req.id, status: "PENDING" },
          data: { status: "CANCELLED", decidedAt: now },
        });
        if (updated.count !== 1) return { ok: false, error: "Đơn đã được xử lý trước đó" } as const;
        return { ok: true, message: "Đã huỷ đơn" } as const;
      }

      if (req.status === "APPROVED") {
        if (!hasRole(actor, "HR")) return { ok: false, error: "Chỉ HR được huỷ đơn đã duyệt" } as const;
        const log = await tx.auditLog.findFirst({
          where: { entity: "request", entityId: req.id, action: "approve" },
          orderBy: { createdAt: "desc" },
        });
        const snapshots = (log?.before ?? []) as unknown as StoredSnapshot[];

        const updated = await tx.request.updateMany({
          where: { id: req.id, status: "APPROVED" },
          data: { status: "CANCELLED", decidedAt: now },
        });
        if (updated.count !== 1) return { ok: false, error: "Đơn đã được xử lý trước đó" } as const;

        await revertSnapshots(tx, snapshots);
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            entity: "request",
            entityId: req.id,
            action: "cancel_approved",
            before: snapshots as unknown as Prisma.InputJsonValue,
            reason: reason ?? null,
          },
        });
        return { ok: true, message: "Đã huỷ đơn và hoàn tác bảng công" } as const;
      }

      return { ok: false, error: "Đơn này không thể huỷ" } as const;
    });
  } catch (e) {
    console.error("cancelRequest failed", e);
    return { ok: false, error: "Không huỷ được đơn, vui lòng thử lại" };
  }
}

// ───────────────────────── Truy vấn ─────────────────────────

const LIST_INCLUDE = {
  user: { select: { fullName: true, employeeCode: true, department: { select: { name: true } } } },
  approver: { select: { fullName: true } },
} as const;

export async function listMyRequests(userId: string) {
  return db.request.findMany({
    where: { userId },
    include: LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** Đơn mà người này có quyền xử lý. Lọc phòng ban ở tầng truy vấn. */
export async function listRequestsForApprover(actor: CurrentUser, status: "PENDING" | "DONE") {
  const scope: Prisma.RequestWhereInput = hasRole(actor, "HR")
    ? { userId: { not: actor.id } }
    : actor.departmentId
      ? { userId: { not: actor.id }, user: { departmentId: actor.departmentId } }
      : { id: "__none__" };

  return db.request.findMany({
    where: {
      ...scope,
      status: status === "PENDING" ? "PENDING" : { in: ["APPROVED", "REJECTED", "CANCELLED"] },
    },
    include: LIST_INCLUDE,
    orderBy: status === "PENDING" ? { createdAt: "asc" } : { updatedAt: "desc" },
    take: status === "PENDING" ? 100 : 30,
  });
}

export type RequestListItem = Awaited<ReturnType<typeof listMyRequests>>[number];
