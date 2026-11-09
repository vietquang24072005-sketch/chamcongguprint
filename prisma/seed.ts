/**
 * Dữ liệu mẫu cho môi trường dev. KHÔNG dùng dữ liệu nhân viên thật.
 *
 * Tài khoản test (mật khẩu chung: SEED_PASSWORD bên dưới):
 *   admin@example.com    (ADMIN)
 *   hr@example.com       (HR)
 *   manager@example.com  (MANAGER, phòng Kỹ thuật)
 *   nv01@example.com     (EMPLOYEE, phòng Kỹ thuật)
 *   nv02@example.com     (EMPLOYEE, phòng Kinh doanh)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const SEED_PASSWORD = "Matkhau@123";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const h = (hh: number, mm = 0) => hh * 60 + mm;

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const [tech, sales] = await Promise.all(
    ["Kỹ thuật", "Kinh doanh"].map((name) =>
      db.department.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );

  const office = await db.shift.upsert({
    where: { name: "Hành chính" },
    update: {},
    create: {
      name: "Hành chính",
      startMinute: h(8),
      endMinute: h(17),
      breakStartMinute: h(12),
      breakEndMinute: h(13),
      lateGraceMinutes: 5,
      earlyGraceMinutes: 5,
    },
  });

  await db.shift.upsert({
    where: { name: "Ca đêm" },
    update: {},
    create: {
      name: "Ca đêm",
      startMinute: h(22),
      endMinute: h(6),
      breakStartMinute: h(2),
      breakEndMinute: h(2, 30),
      lateGraceMinutes: 5,
      earlyGraceMinutes: 5,
    },
  });

  // Toạ độ mẫu — HR/Admin cần sửa lại thành địa chỉ văn phòng thật.
  if ((await db.office.count()) === 0) {
    await db.office.create({
      data: { name: "Văn phòng chính (toạ độ mẫu)", latitude: 21.028511, longitude: 105.804817, radiusM: 100 },
    });
  }

  // Cho phép chấm công từ chính máy dev.
  for (const cidr of ["127.0.0.1", "::1"]) {
    await db.allowedIp.upsert({ where: { cidr }, update: {}, create: { cidr, description: "Máy dev (localhost)" } });
  }

  await db.appConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  // Ngày lễ dương lịch năm 2026. Tết Nguyên đán và Giỗ Tổ thay đổi theo năm — HR nhập theo thông báo chính thức.
  const holidays: [string, string][] = [
    ["2026-01-01", "Tết Dương lịch"],
    ["2026-04-30", "Ngày Giải phóng miền Nam"],
    ["2026-05-01", "Quốc tế Lao động"],
    ["2026-09-02", "Quốc khánh"],
  ];
  for (const [date, name] of holidays) {
    const d = new Date(`${date}T00:00:00.000Z`);
    await db.holiday.upsert({ where: { date: d }, update: {}, create: { date: d, name } });
  }

  const users = [
    { employeeCode: "AD001", email: "admin@example.com", fullName: "Quản trị hệ thống", role: "ADMIN", departmentId: null },
    { employeeCode: "HR001", email: "hr@example.com", fullName: "Nhân sự Mẫu", role: "HR", departmentId: null },
    { employeeCode: "QL001", email: "manager@example.com", fullName: "Trưởng phòng Mẫu", role: "MANAGER", departmentId: tech.id },
    { employeeCode: "NV001", email: "nv01@example.com", fullName: "Nhân viên Một", role: "EMPLOYEE", departmentId: tech.id },
    { employeeCode: "NV002", email: "nv02@example.com", fullName: "Nhân viên Hai", role: "EMPLOYEE", departmentId: sales.id },
  ] as const;

  for (const u of users) {
    await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, shiftId: office.id },
    });
  }

  console.log(`Seed xong: ${users.length} tài khoản, 2 phòng ban, 2 ca làm việc.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
