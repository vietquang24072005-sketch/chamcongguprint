/**
 * Khởi tạo database PRODUCTION lần đầu: 1 tài khoản Admin, ca mặc định, cấu hình, ngày lễ.
 * KHÔNG tạo tài khoản test. Chạy được nhiều lần (bỏ qua phần đã có).
 *
 * Cách chạy (DATABASE_URL trỏ tới database production):
 *   npm run db:bootstrap
 * Script hỏi email, họ tên, mật khẩu Admin ngay trong terminal (mật khẩu không hiện khi gõ).
 * Có thể truyền sẵn qua biến môi trường ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD.
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Ẩn ký tự khi gõ mật khẩu.
      const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
        if (s.startsWith(question)) write.call(rl, question);
        else if (s.includes("\n")) write.call(rl, "\n");
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const h = (hh: number, mm = 0) => hh * 60 + mm;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL");
  const host = new URL(url.replace(/^postgres(ql)?:/, "http:")).hostname;
  console.log(`Database: ${host}`);

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await db.appConfig.upsert({
      where: { id: 1 },
      // Mặc định không kiểm tra vị trí để chạy thử được ngay. Admin cần cấu hình văn phòng/IP trước khi dùng chính thức.
      create: { id: 1, locationMode: "NONE", workingWeekdays: [1, 2, 3, 4, 5] },
      update: {},
    });

    const shift = await db.shift.upsert({
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

    // Ngày lễ dương lịch cố định. Tết Nguyên đán, Giỗ Tổ: Admin/HR nhập theo thông báo hằng năm.
    for (const year of [2026, 2027]) {
      for (const [md, name] of [
        ["01-01", "Tết Dương lịch"],
        ["04-30", "Ngày Giải phóng miền Nam"],
        ["05-01", "Quốc tế Lao động"],
        ["09-02", "Quốc khánh"],
      ] as const) {
        const date = new Date(`${year}-${md}T00:00:00.000Z`);
        await db.holiday.upsert({ where: { date }, update: {}, create: { date, name } });
      }
    }

    const existingAdmin = await db.user.findFirst({ where: { role: "ADMIN", active: true } });
    if (existingAdmin) {
      console.log(`Đã có Admin (${existingAdmin.email}) — không tạo thêm.`);
      return;
    }

    const email = (process.env.ADMIN_EMAIL || (await ask("Email Admin: "))).toLowerCase();
    const fullName = process.env.ADMIN_NAME || (await ask("Họ tên Admin: "));
    let password = process.env.ADMIN_PASSWORD || "";
    if (!password) {
      password = await ask("Mật khẩu Admin (tối thiểu 12 ký tự): ", true);
      const again = await ask("Nhập lại mật khẩu: ", true);
      if (password !== again) throw new Error("Hai lần nhập mật khẩu không khớp");
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Email không hợp lệ");
    if (fullName.length < 2) throw new Error("Họ tên không hợp lệ");
    if (password.length < 12) throw new Error("Mật khẩu Admin cần tối thiểu 12 ký tự");

    await db.user.create({
      data: {
        employeeCode: "AD001",
        email,
        fullName,
        role: "ADMIN",
        passwordHash: await bcrypt.hash(password, 10),
        shiftId: shift.id,
      },
    });
    console.log(`Đã tạo Admin ${email} (mã AD001). Đăng nhập rồi vào Quản trị để thêm nhân viên và cấu hình chấm công.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
