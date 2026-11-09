import "server-only";
import { db } from "@/lib/db";
import { checkLocation } from "@/lib/geo";
import { dateKeyToDb, localDateKey } from "@/lib/time";
import { computeAttendance, resolveWorkDate } from "@/lib/attendance/compute";

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
