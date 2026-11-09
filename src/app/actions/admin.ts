"use server";

import bcrypt from "bcryptjs";
import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { canAssignRole, canManageUser, hhmmToMinute, validateShift, validateUserChange } from "@/lib/admin/rules";
import { firstIssue, stamp, type ActionResult, type FormState } from "@/lib/form-state";
import { dateKeyToDb } from "@/lib/time";
import {
  allowedIpSchema,
  appConfigSchema,
  createUserSchema,
  departmentSchema,
  holidaySchema,
  officeSchema,
  resetPasswordSchema,
  shiftSchema,
  updateUserSchema,
} from "@/lib/validations/admin";

function isUniqueError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

/**
 * Chặn xoá văn phòng / IP cuối cùng khi chế độ xác thực vị trí đang cần nó,
 * nếu không sẽ không ai chấm công được.
 */
async function wouldLockOut(removing: "office" | "ip"): Promise<boolean> {
  const config = await db.appConfig.findUnique({ where: { id: 1 } });
  const mode = config?.locationMode ?? "GPS_OR_IP";
  const [offices, ips] = await Promise.all([db.office.count({ where: { active: true } }), db.allowedIp.count()]);
  const officesAfter = removing === "office" ? offices - 1 : offices;
  const ipsAfter = removing === "ip" ? ips - 1 : ips;
  switch (mode) {
    case "NONE":
      return false;
    case "GPS":
      return officesAfter <= 0;
    case "IP":
      return ipsAfter <= 0;
    case "GPS_AND_IP":
      return officesAfter <= 0 || ipsAfter <= 0;
    case "GPS_OR_IP":
      return officesAfter <= 0 && ipsAfter <= 0;
  }
}

const LOCKOUT_ERROR = "Không thể xoá: chế độ xác thực vị trí hiện tại cần mục này, nhân viên sẽ không chấm công được. Đổi chế độ trước.";

const USER_AUDIT_FIELDS = {
  id: true,
  fullName: true,
  email: true,
  employeeCode: true,
  role: true,
  active: true,
  departmentId: true,
  shiftId: true,
  annualLeaveDays: true,
} as const;

// ───────────────────────── Nhân viên ─────────────────────────

export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("HR");
  const parsed = createUserSchema.safeParse(formObject(formData));
  if (!parsed.success) return stamp({ ok: false, error: firstIssue(parsed.error) });
  const { password, ...data } = parsed.data;
  if (!canAssignRole(actor, data.role)) return stamp({ ok: false, error: "Bạn không có quyền gán vai trò này" });

  try {
    const user = await db.user.create({
      data: { ...data, passwordHash: await bcrypt.hash(password, 10) },
      select: USER_AUDIT_FIELDS,
    });
    await audit(db, { actorId: actor.id, entity: "user", entityId: user.id, action: "create", after: user });
  } catch (e) {
    if (isUniqueError(e)) return stamp({ ok: false, error: "Email hoặc mã nhân viên đã tồn tại" });
    throw e;
  }
  refresh();
  return stamp({ ok: true, message: `Đã tạo tài khoản ${data.employeeCode}` });
}

export async function updateUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("HR");
  const parsed = updateUserSchema.safeParse({ ...formObject(formData), active: formData.get("active") });
  if (!parsed.success) return stamp({ ok: false, error: firstIssue(parsed.error) });
  const { id, ...data } = parsed.data;

  const target = await db.user.findUnique({ where: { id }, select: USER_AUDIT_FIELDS });
  if (!target) return stamp({ ok: false, error: "Không tìm thấy tài khoản" });
  const error = validateUserChange(actor, target, { role: data.role, active: data.active });
  if (error) return stamp({ ok: false, error });

  try {
    const after = await db.user.update({
      where: { id },
      data: { ...data, departmentId: data.departmentId ?? null, shiftId: data.shiftId ?? null },
      select: USER_AUDIT_FIELDS,
    });
    await audit(db, { actorId: actor.id, entity: "user", entityId: id, action: "update", before: target, after });
  } catch (e) {
    if (isUniqueError(e)) return stamp({ ok: false, error: "Email hoặc mã nhân viên đã tồn tại" });
    throw e;
  }
  refresh();
  return stamp({ ok: true, message: "Đã lưu thay đổi" });
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("HR");
  const parsed = resetPasswordSchema.safeParse(formObject(formData));
  if (!parsed.success) return stamp({ ok: false, error: firstIssue(parsed.error) });

  const target = await db.user.findUnique({ where: { id: parsed.data.id }, select: { id: true, role: true } });
  if (!target) return stamp({ ok: false, error: "Không tìm thấy tài khoản" });
  if (!canManageUser(actor, target)) return stamp({ ok: false, error: "Bạn không có quyền đổi mật khẩu tài khoản này" });

  await db.user.update({
    where: { id: target.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) },
  });
  await audit(db, { actorId: actor.id, entity: "user", entityId: target.id, action: "reset_password" });
  return stamp({ ok: true, message: "Đã đặt lại mật khẩu" });
}

// ───────────────────────── Phòng ban ─────────────────────────

export async function saveDepartmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("HR");
  const parsed = departmentSchema.safeParse(formObject(formData));
  if (!parsed.success) return stamp({ ok: false, error: firstIssue(parsed.error) });
  const { id, name } = parsed.data;

  try {
    if (id) {
      const before = await db.department.findUnique({ where: { id } });
      if (!before) return stamp({ ok: false, error: "Không tìm thấy phòng ban" });
      await db.department.update({ where: { id }, data: { name } });
      await audit(db, { actorId: actor.id, entity: "department", entityId: id, action: "update", before, after: { name } });
    } else {
      const created = await db.department.create({ data: { name } });
      await audit(db, { actorId: actor.id, entity: "department", entityId: created.id, action: "create", after: created });
    }
  } catch (e) {
    if (isUniqueError(e)) return stamp({ ok: false, error: "Tên phòng ban đã tồn tại" });
    throw e;
  }
  refresh();
  return stamp({ ok: true, message: id ? "Đã đổi tên" : "Đã thêm phòng ban" });
}

export async function deleteDepartmentAction(id: string): Promise<ActionResult> {
  const actor = await requireRole("HR");
  const dept = await db.department.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!dept) return { ok: false, error: "Không tìm thấy phòng ban" };
  if (dept._count.users > 0) return { ok: false, error: `Còn ${dept._count.users} nhân viên trong phòng ban này` };
  await db.department.delete({ where: { id } });
  await audit(db, { actorId: actor.id, entity: "department", entityId: id, action: "delete", before: { name: dept.name } });
  refresh();
  return { ok: true, message: "Đã xoá phòng ban" };
}

// ───────────────────────── Ca làm việc ─────────────────────────

export async function saveShiftAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("HR");
  const parsed = shiftSchema.safeParse(formObject(formData));
  if (!parsed.success) return stamp({ ok: false, error: firstIssue(parsed.error) });
  const v = parsed.data;

  const data = {
    name: v.name,
    startMinute: hhmmToMinute(v.start),
    endMinute: hhmmToMinute(v.end),
    breakStartMinute: v.breakStart ? hhmmToMinute(v.breakStart) : null,
    breakEndMinute: v.breakEnd ? hhmmToMinute(v.breakEnd) : null,
    lateGraceMinutes: v.lateGraceMinutes,
    earlyGraceMinutes: v.earlyGraceMinutes,
  };
  const error = validateShift(data);
  if (error) return stamp({ ok: false, error });

  try {
    if (v.id) {
      const before = await db.shift.findUnique({ where: { id: v.id } });
      if (!before) return stamp({ ok: false, error: "Không tìm thấy ca" });
      await db.shift.update({ where: { id: v.id }, data });
      await audit(db, { actorId: actor.id, entity: "shift", entityId: v.id, action: "update", before, after: data });
    } else {
      const created = await db.shift.create({ data });
      await audit(db, { actorId: actor.id, entity: "shift", entityId: created.id, action: "create", after: created });
    }
  } catch (e) {
    if (isUniqueError(e)) return stamp({ ok: false, error: "Tên ca đã tồn tại" });
    throw e;
  }
  refresh();
  return stamp({ ok: true, message: v.id ? "Đã lưu ca" : "Đã thêm ca" });
}

export async function deleteShiftAction(id: string): Promise<ActionResult> {
  const actor = await requireRole("HR");
  const shift = await db.shift.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!shift) return { ok: false, error: "Không tìm thấy ca" };
  if (shift._count.users > 0) return { ok: false, error: `Còn ${shift._count.users} nhân viên đang dùng ca này` };
  await db.shift.delete({ where: { id } });
  await audit(db, { actorId: actor.id, entity: "shift", entityId: id, action: "delete", before: shift });
  refresh();
  return { ok: true, message: "Đã xoá ca" };
}

// ───────────────────────── Ngày lễ ─────────────────────────

export async function createHolidayAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("HR");
  const parsed = holidaySchema.safeParse(formObject(formData));
  if (!parsed.success) return stamp({ ok: false, error: firstIssue(parsed.error) });

  try {
    const created = await db.holiday.create({ data: { date: dateKeyToDb(parsed.data.date), name: parsed.data.name } });
    await audit(db, { actorId: actor.id, entity: "holiday", entityId: created.id, action: "create", after: parsed.data });
  } catch (e) {
    if (isUniqueError(e)) return stamp({ ok: false, error: "Ngày này đã có trong danh sách ngày lễ" });
    throw e;
  }
  refresh();
  return stamp({ ok: true, message: "Đã thêm ngày lễ" });
}

export async function deleteHolidayAction(id: string): Promise<ActionResult> {
  const actor = await requireRole("HR");
  const holiday = await db.holiday.findUnique({ where: { id } });
  if (!holiday) return { ok: false, error: "Không tìm thấy ngày lễ" };
  await db.holiday.delete({ where: { id } });
  await audit(db, { actorId: actor.id, entity: "holiday", entityId: id, action: "delete", before: holiday });
  refresh();
  return { ok: true, message: "Đã xoá ngày lễ" };
}

// ───────────────────────── Cấu hình hệ thống (ADMIN) ─────────────────────────

export async function updateAppConfigAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("ADMIN");
  const parsed = appConfigSchema.safeParse({
    locationMode: formData.get("locationMode"),
    workingWeekdays: formData.getAll("workingWeekdays"),
  });
  if (!parsed.success) return stamp({ ok: false, error: firstIssue(parsed.error) });

  if (parsed.data.locationMode !== "NONE") {
    const [offices, ips] = await Promise.all([db.office.count({ where: { active: true } }), db.allowedIp.count()]);
    const needsGps = ["GPS", "GPS_AND_IP"].includes(parsed.data.locationMode);
    const needsIp = ["IP", "GPS_AND_IP"].includes(parsed.data.locationMode);
    if (needsGps && offices === 0) return stamp({ ok: false, error: "Cần thêm ít nhất một văn phòng trước" });
    if (needsIp && ips === 0) return stamp({ ok: false, error: "Cần thêm ít nhất một IP trước" });
    if (parsed.data.locationMode === "GPS_OR_IP" && offices === 0 && ips === 0) {
      return stamp({ ok: false, error: "Cần thêm văn phòng hoặc IP trước" });
    }
  }

  const before = await db.appConfig.findUnique({ where: { id: 1 } });
  await db.appConfig.upsert({ where: { id: 1 }, create: { id: 1, ...parsed.data }, update: parsed.data });
  await audit(db, { actorId: actor.id, entity: "app_config", entityId: "1", action: "update", before, after: parsed.data });
  refresh();
  return stamp({ ok: true, message: "Đã lưu cấu hình" });
}

export async function createOfficeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("ADMIN");
  const parsed = officeSchema.safeParse(formObject(formData));
  if (!parsed.success) return stamp({ ok: false, error: firstIssue(parsed.error) });
  const created = await db.office.create({ data: parsed.data });
  await audit(db, { actorId: actor.id, entity: "office", entityId: created.id, action: "create", after: created });
  refresh();
  return stamp({ ok: true, message: "Đã thêm văn phòng" });
}

export async function deleteOfficeAction(id: string): Promise<ActionResult> {
  const actor = await requireRole("ADMIN");
  const office = await db.office.findUnique({ where: { id } });
  if (!office) return { ok: false, error: "Không tìm thấy văn phòng" };
  if (office.active && (await wouldLockOut("office"))) return { ok: false, error: LOCKOUT_ERROR };
  await db.office.delete({ where: { id } });
  await audit(db, { actorId: actor.id, entity: "office", entityId: id, action: "delete", before: office });
  refresh();
  return { ok: true, message: "Đã xoá văn phòng" };
}

export async function createAllowedIpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireRole("ADMIN");
  const parsed = allowedIpSchema.safeParse(formObject(formData));
  if (!parsed.success) return stamp({ ok: false, error: firstIssue(parsed.error) });
  try {
    const created = await db.allowedIp.create({ data: parsed.data });
    await audit(db, { actorId: actor.id, entity: "allowed_ip", entityId: created.id, action: "create", after: created });
  } catch (e) {
    if (isUniqueError(e)) return stamp({ ok: false, error: "IP này đã có trong danh sách" });
    throw e;
  }
  refresh();
  return stamp({ ok: true, message: "Đã thêm IP" });
}

export async function deleteAllowedIpAction(id: string): Promise<ActionResult> {
  const actor = await requireRole("ADMIN");
  const ip = await db.allowedIp.findUnique({ where: { id } });
  if (!ip) return { ok: false, error: "Không tìm thấy IP" };
  if (await wouldLockOut("ip")) return { ok: false, error: LOCKOUT_ERROR };
  await db.allowedIp.delete({ where: { id } });
  await audit(db, { actorId: actor.id, entity: "allowed_ip", entityId: id, action: "delete", before: ip });
  refresh();
  return { ok: true, message: "Đã xoá IP" };
}
