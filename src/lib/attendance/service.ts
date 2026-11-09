import "server-only";
import { db } from "@/lib/db";
import { checkLocation } from "@/lib/geo";
import { dateKeyToDb, localDateKey, localMinuteToInstant } from "@/lib/time";
import { computeAttendance, resolveWorkDate } from "@/lib/attendance/compute";
import { audit } from "@/lib/audit";
import { hhmmToMinute } from "@/lib/admin/rules";
import type { ActionResult } from "@/lib/form-state";

export type PunchInput = {
  userId: string;
  now: Date;
  ip: string | null;
  userAgent: string | null;
  coords: { latitude: number; longitude: number } | null;
};

export type PunchResult = { ok: true; message: string } | { ok: false; error: string };

async function verifyLocation(input: PunchInput) {
  const [config, offices, ips] = await Promise.all([
    db.appConfig.findUnique({ where: { id: 1 } }),
    db.office.findMany({ where: { active: true } }),
    db.allowedIp.findMany(),
  ]);
  return checkLocation({
    mode: config?.locationMode ?? "GPS_OR_IP",
    offices,
    allowedCidrs: ips.map((i) => i.cidr),
    ip: input.ip,
    coords: input.coords,
  });
}

export async function checkIn(input: PunchInput): Promise<PunchResult> {
  const user = await db.user.findUnique({ where: { id: input.userId }, include: { shift: true } });
  if (!user) return { ok: false, error: "Không tìm thấy tài khoản" };

  const location = await verifyLocation(input);
  if (!location.ok) return { ok: false, error: location.reason };

  const workDate = resolveWorkDate(input.now, user.shift);
  const existing = await db.attendance.findUnique({
    where: { userId_workDate: { userId: user.id, workDate: dateKeyToDb(workDate) } },
  });
  if (existing?.checkInAt) return { ok: false, error: "Bạn đã check-in cho ngày công này rồi" };

  const computed = user.shift
    ? computeAttendance({ workDate, shift: user.shift, checkInAt: input.now, checkOutAt: null })
    : { status: "MISSING_CHECKOUT" as const, lateMinutes: 0, earlyMinutes: 0, workedMinutes: 0 };

  const data = {
    checkInAt: input.now,
    checkInLat: input.coords?.latitude ?? null,
    checkInLng: input.coords?.longitude ?? null,
    checkInIp: input.ip,
    checkInUserAgent: input.userAgent,
    ...computed,
  };

  await db.attendance.upsert({
    where: { userId_workDate: { userId: user.id, workDate: dateKeyToDb(workDate) } },
    create: { userId: user.id, workDate: dateKeyToDb(workDate), ...data },
    update: data,
  });

  const lateNote = computed.lateMinutes > 0 ? ` (muộn ${computed.lateMinutes} phút)` : "";
  return { ok: true, message: `Check-in thành công${lateNote}` };
}

export async function checkOut(input: PunchInput): Promise<PunchResult> {
  const user = await db.user.findUnique({ where: { id: input.userId }, include: { shift: true } });
  if (!user) return { ok: false, error: "Không tìm thấy tài khoản" };

  const location = await verifyLocation(input);
  if (!location.ok) return { ok: false, error: location.reason };

  const workDate = resolveWorkDate(input.now, user.shift);
  const record = await db.attendance.findUnique({
    where: { userId_workDate: { userId: user.id, workDate: dateKeyToDb(workDate) } },
  });
  if (!record?.checkInAt) return { ok: false, error: "Bạn chưa check-in hôm nay" };

  // Cho phép check-out nhiều lần, lấy lần cuối.
  const computed = user.shift
    ? computeAttendance({ workDate, shift: user.shift, checkInAt: record.checkInAt, checkOutAt: input.now })
    : {
        status: "PRESENT" as const,
        lateMinutes: 0,
        earlyMinutes: 0,
        workedMinutes: Math.floor((input.now.getTime() - record.checkInAt.getTime()) / 60000),
      };

  await db.attendance.update({
    where: { id: record.id },
    data: {
      checkOutAt: input.now,
      checkOutLat: input.coords?.latitude ?? null,
      checkOutLng: input.coords?.longitude ?? null,
      checkOutIp: input.ip,
      checkOutUserAgent: input.userAgent,
      ...computed,
    },
  });

  const earlyNote = computed.earlyMinutes > 0 ? ` (về sớm ${computed.earlyMinutes} phút)` : "";
  return { ok: true, message: `Check-out thành công${earlyNote}` };
}

/** Bản ghi công của ngày công hiện tại. */
export async function getTodayAttendance(userId: string, now: Date) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { shift: true } });
  const workDate = resolveWorkDate(now, user?.shift ?? null);
  const record = await db.attendance.findUnique({
    where: { userId_workDate: { userId, workDate: dateKeyToDb(workDate) } },
  });
  return { workDate, shift: user?.shift ?? null, record, todayKey: localDateKey(now) };
}

export async function listAttendance(userId: string, fromKey: string, toKey: string) {
  return db.attendance.findMany({
    where: { userId, workDate: { gte: dateKeyToDb(fromKey), lte: dateKeyToDb(toKey) } },
    orderBy: { workDate: "desc" },
  });
}

/**
 * HR sửa công thủ công cho một ngày. Bắt buộc có lý do; ghi audit log trước/sau.
 * - Có giờ vào: tính lại công theo ca (giờ ra nhỏ hơn giờ vào = sang hôm sau).
 * - Bỏ trống cả hai giờ: đánh dấu vắng mặt (giữ bản ghi, không xoá).
 */
export async function adjustAttendance(input: {
  actorId: string;
  userId: string;
  workDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  note?: string;
  reason: string;
  now: Date;
}): Promise<ActionResult> {
  if (input.actorId === input.userId) return { ok: false, error: "Không thể tự sửa công của mình" };
  if (input.workDate > localDateKey(input.now)) return { ok: false, error: "Không thể sửa công cho ngày trong tương lai" };
  if (!input.checkInTime && input.checkOutTime) return { ok: false, error: "Cần nhập giờ vào nếu có giờ ra" };

  const user = await db.user.findUnique({ where: { id: input.userId }, include: { shift: true } });
  if (!user) return { ok: false, error: "Không tìm thấy nhân viên" };

  const checkInAt = input.checkInTime ? localMinuteToInstant(input.workDate, hhmmToMinute(input.checkInTime)) : null;
  let checkOutAt = input.checkOutTime ? localMinuteToInstant(input.workDate, hhmmToMinute(input.checkOutTime)) : null;
  if (checkInAt && checkOutAt && checkOutAt <= checkInAt) {
    checkOutAt = new Date(checkOutAt.getTime() + 24 * 60 * 60 * 1000);
  }

  const computed = !checkInAt
    ? { status: "ABSENT" as const, lateMinutes: 0, earlyMinutes: 0, workedMinutes: 0 }
    : user.shift
      ? computeAttendance({ workDate: input.workDate, shift: user.shift, checkInAt, checkOutAt })
      : {
          status: checkOutAt ? ("PRESENT" as const) : ("MISSING_CHECKOUT" as const),
          lateMinutes: 0,
          earlyMinutes: 0,
          workedMinutes: checkOutAt ? Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60000) : 0,
        };

  const data = { checkInAt, checkOutAt, ...computed, note: input.note ?? null };
  const where = { userId_workDate: { userId: user.id, workDate: dateKeyToDb(input.workDate) } };

  await db.$transaction(async (tx) => {
    const before = await tx.attendance.findUnique({ where });
    const after = await tx.attendance.upsert({
      where,
      create: { userId: user.id, workDate: dateKeyToDb(input.workDate), ...data },
      update: data,
    });
    const pick = (r: typeof after | null) =>
      r && {
        workDate: input.workDate,
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt,
        status: r.status,
        lateMinutes: r.lateMinutes,
        earlyMinutes: r.earlyMinutes,
        workedMinutes: r.workedMinutes,
        note: r.note,
      };
    await audit(tx, {
      actorId: input.actorId,
      entity: "attendance",
      entityId: after.id,
      action: "manual_adjust",
      before: pick(before),
      after: pick(after),
      reason: input.reason,
    });
  });
  return { ok: true, message: "Đã cập nhật công" };
}
