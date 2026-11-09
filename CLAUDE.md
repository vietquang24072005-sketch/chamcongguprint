# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong dự án **Chấm công online** — web chấm công nội bộ cho công ty.

> Khung dự án đã được khởi tạo. Khi thay đổi stack hay quy ước, cập nhật file này trước rồi mới code.

@AGENTS.md

## Mục tiêu sản phẩm

Nhân viên chấm công vào/ra hằng ngày trên web (máy tính và điện thoại). Quản lý duyệt đơn và xem báo cáo. Bộ phận HR/kế toán xuất bảng công cuối tháng để tính lương.

### Vai trò người dùng
| Vai trò | Quyền chính |
|---|---|
| `EMPLOYEE` | Check-in/check-out, xem lịch sử công của mình, gửi đơn nghỉ phép / đi muộn / quên chấm công / tăng ca |
| `MANAGER` | Toàn bộ quyền EMPLOYEE + duyệt đơn và xem công của nhân viên trong phòng ban mình |
| `HR` | Quản lý nhân viên, ca làm việc, ngày lễ, chỉnh sửa công (có ghi log), xuất báo cáo |
| `ADMIN` | Toàn quyền, cấu hình hệ thống (địa điểm văn phòng, IP cho phép, quy định công) |

### Tính năng cốt lõi (MVP)
1. **Đăng nhập** bằng email/mã nhân viên + mật khẩu. Không có tự đăng ký — HR tạo tài khoản.
2. **Check-in / Check-out** với xác thực vị trí:
   - GPS: trong bán kính cho phép quanh văn phòng (mặc định 100m), **và/hoặc**
   - IP: thuộc danh sách IP/dải IP mạng công ty.
   - Lưu lại thời gian server, toạ độ, IP, user agent. **Không bao giờ tin thời gian từ client.**
3. **Ca làm việc**: giờ vào, giờ ra, nghỉ trưa, số phút cho phép đi muộn/về sớm. Nhân viên có thể được gán ca khác nhau.
4. **Tính công**: đi muộn, về sớm, thiếu giờ, vắng mặt, công nửa ngày, tăng ca.
5. **Đơn từ**: nghỉ phép (có/không lương), quên chấm công, đi muộn/về sớm, tăng ca, công tác. Luồng: gửi → quản lý duyệt/từ chối → cập nhật vào bảng công.
6. **Quỹ phép năm**: số ngày phép còn lại, tự trừ khi đơn nghỉ phép được duyệt.
7. **Bảng công tháng** + **xuất Excel**.
8. **Ngày lễ / ngày nghỉ** do HR cấu hình.

### Ngoài phạm vi MVP (làm sau)
Nhận diện khuôn mặt, chấm công bằng QR, app mobile native, tích hợp tính lương, thông báo qua Zalo/email.

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack) + React 19 + TypeScript strict
- **UI**: Tailwind CSS v4, font Be Vietnam Pro, mobile-first. Chưa cài shadcn/ui — thêm khi cần component phức tạp.
- **Database**: PostgreSQL + Prisma 7 (driver adapter `@prisma/adapter-pg`, client sinh ra ở `src/generated/prisma`)
- **Auth**: tự viết theo hướng dẫn chính thức của Next — JWT ký bằng `jose` lưu trong cookie httpOnly, mật khẩu hash bằng `bcryptjs`
- **Validation**: Zod 4 — dùng chung schema cho form và server
- **Ngày giờ**: `date-fns` + `@date-fns/tz`
- **Xuất Excel**: `exceljs` (đã cài, chưa dùng)
- **Test**: Vitest (unit). Playwright cho e2e: chưa cài.
- **Package manager**: npm

### Lưu ý khi viết code với Next 16 / Prisma 7
- Next 16 khác nhiều so với các bản cũ — đọc tài liệu trong `node_modules/next/dist/docs/` trước khi dùng API lạ (xem AGENTS.md).
- **Middleware giờ là Proxy**: `src/proxy.ts`, export hàm `proxy`. Chỉ dùng để chuyển hướng lạc quan, không thay cho kiểm tra quyền.
- **Cache Components đang bật** (`cacheComponents: true`): mọi component đọc `cookies()`, `headers()`, truy vấn DB hay `new Date()` phải nằm trong `<Suspense>`. Không `await` phiên đăng nhập ở cấp cao nhất của layout. Mẫu: `src/app/(app)/dashboard/page.tsx`.
- Sau khi Server Action thay đổi dữ liệu, gọi `refresh()` từ `next/cache` để làm mới giao diện.
- Prisma 7: import client từ `@/generated/prisma/client`, enum từ `@/generated/prisma/enums`. Cấu hình CLI ở `prisma.config.ts` (không còn đọc `url` trong schema). Sau khi sửa schema: `npm run db:migrate` rồi `npx prisma generate`.
- Code chạy ngoài Next (seed, script) không được import file có `import "server-only"` (ví dụ `src/lib/db.ts`) — tự tạo PrismaClient như trong `prisma/seed.ts`.

## Cấu trúc thư mục

```
src/
  proxy.ts                   # Chuyển hướng theo cookie phiên
  app/
    login/                   # Đăng nhập
    (app)/                   # Layout sau khi đăng nhập (header + menu theo vai trò)
      dashboard/             # Nút check-in/out, trạng thái hôm nay
      attendance/            # Lịch sử chấm công tháng này
      requests/              # Quỹ phép, gửi đơn, danh sách đơn của mình
      approvals/             # Duyệt / từ chối — MANAGER+; HR huỷ đơn đã duyệt
      reports/               # HR+: bảng công tháng; [userId]/ chi tiết + sửa công; export/ route xuất Excel
      admin/                 # HR+: employees/, departments/, shifts/, holidays/; ADMIN: settings/
    actions/                 # Server Actions: auth, attendance, requests, admin
  components/                # UI dùng chung: ActionForm, ConfirmButton, Field/Card/inputClass
  generated/prisma/          # Prisma client (tự sinh, không sửa, không commit)
  lib/
    auth.ts                  # Data Access Layer: getCurrentUser, requireUser, requireRole, hasRole
    session.ts               # Tạo/đọc/xoá cookie phiên (server-only)
    session-token.ts         # Ký/xác minh JWT (dùng chung cho proxy)
    db.ts                    # Prisma client singleton
    time.ts                  # Helper múi giờ VN, dateKey "yyyy-MM-dd"
    geo.ts                   # Haversine, so khớp IP/CIDR, checkLocation
    labels.ts                # Nhãn tiếng Việt cho enum
    attendance/
      compute.ts             # Logic tính công — hàm thuần, có unit test
      service.ts             # Check-in/out, truy vấn công (gọi DB)
    admin/rules.ts           # Ai được quản lý / gán vai trò cho ai, kiểm tra ca — hàm thuần, có unit test
    audit.ts                 # Helper ghi audit_logs
    form-state.ts            # ActionResult / FormState dùng chung cho Server Actions
    reports/
      summary.ts             # Tổng hợp công tháng + ký hiệu ngày — hàm thuần, có unit test
      service.ts             # Lấy dữ liệu bảng công tháng (DB)
    requests/
      rules.ts               # Đếm ngày phép, ngày làm việc, quyền duyệt — hàm thuần, có unit test
      service.ts             # Tạo / huỷ / duyệt đơn, áp dụng & hoàn tác bảng công
    validations/             # Zod schemas
prisma/
  schema.prisma
  migrations/
  seed.ts                    # Dữ liệu mẫu: phòng ban, ca, văn phòng, tài khoản test
```

## Lệnh thường dùng

```bash
npm install              # tự chạy prisma generate
npm run db:start         # chạy Postgres cục bộ (prisma dev, không cần Docker)
npm run db:stop
npm run db:migrate       # tạo/áp migration
npm run db:seed          # nạp dữ liệu mẫu
npm run db:studio        # xem dữ liệu
npm run dev              # http://localhost:3000
npm run build && npm start
npm run lint
npm run typecheck        # next typegen && tsc --noEmit
npm test                 # Vitest
```

Biến môi trường đặt trong `.env` (không commit), mẫu ở `.env.example`: `DATABASE_URL`, `SESSION_SECRET`, `APP_TIMEZONE=Asia/Ho_Chi_Minh`. Database dev do `prisma dev` tạo chạy ở cổng 51218 — nếu cổng khác, xem bằng `npx prisma dev ls`.

## Triển khai (production)

- Hosting: **Vercel**, project `chamcongguprint` → https://chamcongguprint.vercel.app. Database: Postgres trên Neon (Vercel Storage).
- Biến môi trường trên Vercel: `DATABASE_URL`, `SESSION_SECRET`, `APP_TIMEZONE`.
- Build dùng script `vercel-build` = `prisma generate && prisma migrate deploy && next build` → migration tự áp dụng mỗi lần deploy. Vì vậy **mọi thay đổi schema phải đi kèm file migration** trong `prisma/migrations/`.
- Tạo migration: `npm run db:migrate -- --name <tên>`. Nếu shadow DB của `prisma dev` lỗi, sinh bằng `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script -o prisma/migrations/<timestamp>_<tên>/migration.sql` rồi `npm run db:deploy`.
- Khởi tạo production lần đầu: `npx vercel env pull .env.production.local` rồi `npm run db:bootstrap:prod` (hỏi email/mật khẩu Admin trong terminal; không tạo tài khoản test). **`npm run db:seed` tự từ chối chạy khi DATABASE_URL không phải localhost.**
- Bảo mật đã có: giới hạn đăng nhập (sai 5 lần/tài khoản hoặc 20 lần/IP trong 15 phút → khoá tạm, bảng `login_attempts`), header bảo mật trong `next.config.ts`, cookie phiên `secure` ở production, người dùng tự đổi mật khẩu tại `/account`.

## Quy tắc nghiệp vụ quan trọng

- **Múi giờ**: lưu mọi thời điểm trong DB ở **UTC** (`timestamptz`). Hiển thị và tính "ngày công" theo `Asia/Ho_Chi_Minh`. Ranh giới ngày phải tính theo giờ Việt Nam, không theo UTC.
- **Ca qua đêm** (ví dụ 22:00–06:00): ngày công thuộc về ngày bắt đầu ca. Logic tính công phải xử lý được trường hợp này.
- **Thời gian chấm công lấy từ server**, không nhận timestamp từ client.
- Mỗi nhân viên chỉ có **một bản ghi công cho mỗi ngày công**; check-in lần đầu tạo bản ghi, check-out cập nhật giờ ra (cho phép check-out nhiều lần, lấy lần cuối).
- Mọi chỉnh sửa công thủ công của HR phải ghi vào bảng **audit log** (ai sửa, lúc nào, giá trị cũ → mới, lý do). Không xoá cứng dữ liệu chấm công.
- Khi đơn được duyệt, cập nhật lại bảng công của ngày liên quan; khi đơn bị huỷ sau duyệt, hoàn tác (kể cả hoàn lại ngày phép).
- Ngày lễ và cuối tuần (theo cấu hình) không tính là vắng mặt.

### Đơn từ (đã cài đặt)
- **Quỹ phép không lưu số dư**: số còn lại = `annualLeaveDays` − đơn phép năm đã duyệt − đơn đang chờ, tính theo từng năm dương lịch. Huỷ đơn thì phép tự hoàn lại.
- **Quyền duyệt** (`canApprove`): MANAGER duyệt đơn của nhân viên cùng phòng; HR/ADMIN duyệt mọi phòng; không ai tự duyệt đơn của mình.
- **Huỷ đơn**: người gửi huỷ được đơn đang chờ của mình; chỉ HR/ADMIN huỷ được đơn đã duyệt.
- **Khi duyệt**, tác động lên bảng công:
  - Nghỉ phép / không lương: các ngày làm việc trong khoảng → `ON_LEAVE`. Ngày đã có chấm công thì giữ nguyên, chỉ thêm ghi chú.
  - Công tác: → `PRESENT`, tính đủ giờ của ca.
  - Quên chấm công: điền giờ vào/ra đề xuất rồi tính lại công.
  - Đi muộn / về sớm: xoá số phút muộn/sớm.
  - Tăng ca: không đổi bảng công, chỉ lưu trên đơn để báo cáo cộng sau.
- **Hoàn tác khi huỷ đơn đã duyệt**: lúc duyệt, trạng thái cũ của từng ngày bị ảnh hưởng được chụp vào `audit_logs.before` (action `approve`). Khi huỷ, khôi phục từ ảnh chụp đó; bản ghi công do chính đơn tạo ra thì bị xoá (ngoại lệ duy nhất của quy tắc không xoá cứng).
- Duyệt/huỷ chạy trong transaction, dùng `updateMany ... where status` làm khoá lạc quan để tránh hai người xử lý cùng lúc.
- Không cho tạo đơn nghỉ/công tác trùng khoảng ngày với đơn đang chờ hoặc đã duyệt (trừ hai đơn nửa ngày cùng một ngày).

### Quản trị (đã cài đặt)
- **Phân quyền tài khoản** (`lib/admin/rules.ts`):
  - HR chỉ tạo/sửa tài khoản EMPLOYEE / MANAGER; ADMIN quản lý tất cả.
  - Không ai tự đổi vai trò hay tự khoá mình, nên luôn còn ít nhất một ADMIN.
- **Nghỉ việc = khoá tài khoản** (`active = false`), không xoá: dữ liệu công cũ vẫn giữ. Tài khoản bị khoá không đăng nhập được.
- **Xoá có điều kiện**:
  - Phòng ban / ca chỉ xoá được khi không còn nhân viên nào gắn vào.
  - Không xoá được văn phòng / IP cuối cùng nếu chế độ xác thực vị trí đang cần nó (tránh khoá mọi người khỏi chấm công).
- Sửa giờ ca **không** tính lại công đã ghi; chỉ áp dụng cho lần chấm sau.
- Mọi thao tác quản trị đều ghi `audit_logs` (entity: `user`, `department`, `shift`, `holiday`, `office`, `allowed_ip`, `app_config`). Không bao giờ ghi mật khẩu/hash vào log.
- Trang **Cấu hình chấm công** (`/admin/settings`) chỉ dành cho ADMIN.
- Chuyển hướng `/` → `/dashboard` và `/admin` → `/admin/employees` khai báo trong `next.config.ts` (`redirects`), không dùng trang chỉ gọi `redirect()` vì Next 16 báo lỗi khi kiểm tra prerender.

### Báo cáo (đã cài đặt)
- **Không lưu bảng công tổng hợp** — luôn tính lại từ `attendances` + đơn đã duyệt bằng `buildMonthlySummary`. Nghỉ phép / công tác / tăng ca lấy từ **đơn đã duyệt**, không dựa vào status `ON_LEAVE` trên bảng công.
- Quy tắc tính (xem đầu `lib/reports/summary.ts` cho bảng ký hiệu X, M, S, MS, Q, P, KL, CT, V, L…):
  - Công chuẩn = ngày làm việc trong tháng (trừ lễ), chỉ tính từ ngày tạo tài khoản.
  - Ngày làm việc đã qua mà không chấm và không có đơn → vắng. **Hôm nay chưa tính vắng**, quên check-out hôm nay chưa tính.
  - Nghỉ nửa ngày có chấm công → 0.5 có mặt + 0.5 phép; không chấm → 0.5 phép + 0.5 vắng.
  - Ngày lễ rơi vào ngày làm việc → được trả công. Làm cuối tuần → cộng giờ làm, không cộng ngày công.
  - Tăng ca = tổng giờ của đơn tăng ca đã duyệt có ngày bắt đầu trong tháng.
  - **Công tính lương = có mặt + công tác + phép năm + lễ.**
- Danh sách gồm nhân viên đang làm và nhân viên đã khoá nhưng có công trong tháng.
- **Sửa công thủ công** (`adjustAttendance`): chỉ HR+, bắt buộc lý do, ghi audit `attendance/manual_adjust` trước/sau; không tự sửa công của mình; không sửa ngày tương lai; bỏ trống cả hai giờ = vắng (giữ bản ghi).
- Xuất Excel: `GET /reports/export?month=yyyy-MM&dept=` (route handler, tự kiểm tra quyền HR) → 2 sheet "Tổng hợp" và "Chấm công chi tiết" (ký hiệu theo ngày, có màu).

### Quy ước UI
- Form gọi Server Action: dùng `<ActionForm action={...} submitLabel="..." resetOnSuccess?>`, action có chữ ký `(prev: FormState, formData) => Promise<FormState>` và trả về `stamp({...})`.
- Nút xoá/huỷ có xác nhận: `<ConfirmButton action={serverAction.bind(null, id)} ... />`.
- Ô nhập: `inputClass` (khối, rộng 100%) hoặc `inputBase` (dùng trong hàng ngang như thanh lọc).
- Logic tính công đặt trong `src/lib/attendance/` dưới dạng hàm thuần (không gọi DB trực tiếp) để dễ unit test. Mỗi quy tắc mới phải kèm test, đặc biệt các ca biên: đi muộn đúng ngưỡng cho phép, ca qua đêm, quên check-out, ngày lễ.

## Bảo mật & phân quyền

- Kiểm tra quyền **ở server** trong mọi Server Action / route handler — ẩn nút trên UI là không đủ.
- MANAGER chỉ truy cập dữ liệu nhân viên trong phòng ban mình; luôn lọc theo `departmentId` ở tầng truy vấn.
- Toạ độ GPS do client gửi có thể bị giả mạo — với văn phòng yêu cầu nghiêm ngặt, kết hợp thêm kiểm tra IP.
- Rate limit đăng nhập: đã có (`lib/rate-limit.ts` + `login_attempts`). Check-in chưa cần vì mỗi ngày chỉ một bản ghi.
- Không log mật khẩu, token hay toạ độ chi tiết ra console ở production.

## Quy ước code

- TypeScript strict, không dùng `any` trừ khi có lý do ghi rõ trong comment.
- Ưu tiên Server Components; chỉ dùng `"use client"` khi cần tương tác (nút check-in cần Geolocation API).
- Mutation dùng Server Actions, input luôn validate bằng Zod.
- Tên biến, hàm, file, bảng DB bằng **tiếng Anh**; nội dung hiển thị cho người dùng bằng **tiếng Việt** (gom vào một chỗ để sau này dễ đa ngôn ngữ).
- Bảng DB và cột dùng `snake_case` qua `@@map`/`@map` của Prisma; model trong code dùng `PascalCase`.
- Định dạng ngày hiển thị `dd/MM/yyyy`, giờ `HH:mm`.
- Trước khi báo xong một thay đổi: chạy `npm run lint`, `npm run typecheck`, `npm test`.
- Giờ ca lưu dạng **số phút kể từ 00:00 giờ VN** (`startMinute`, `endMinute`); `endMinute <= startMinute` là ca qua đêm. Với ca qua đêm, lần chấm trước 12:00 trưa thuộc ngày công hôm trước (`resolveWorkDate`).
- Cột ngày công (`@db.Date`) trao đổi trong code dưới dạng chuỗi `"yyyy-MM-dd"`; chuyển đổi bằng `dateKeyToDb` / `dbDateToKey` trong `lib/time.ts`.
- IP lấy từ header `x-forwarded-for` — chỉ đáng tin khi deploy sau reverse proxy do công ty kiểm soát.

## Dữ liệu test

Tài khoản test cho từng vai trò được tạo trong `prisma/seed.ts`. Không dùng dữ liệu nhân viên thật trong seed, fixture hay test.
