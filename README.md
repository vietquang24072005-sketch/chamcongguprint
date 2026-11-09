# Chấm công online

Web chấm công nội bộ: nhân viên check-in/check-out (xác thực GPS hoặc IP mạng công ty), gửi đơn từ; quản lý duyệt đơn; HR quản trị nhân viên, sửa công và xuất bảng công Excel.

## Chạy trên máy (dev)

```bash
npm install
cp .env.example .env     # điền SESSION_SECRET; DATABASE_URL dùng Postgres cục bộ
npm run db:start         # Postgres cục bộ (prisma dev, không cần Docker)
npm run db:migrate
npm run db:seed          # tài khoản test: xem đầu file prisma/seed.ts (chỉ chạy được với localhost)
npm run dev
```

Mở http://localhost:3000.

## Triển khai (Vercel + Postgres)

1. Tạo database Postgres (đang dùng Prisma Postgres; Postgres nào cũng được) và đặt biến môi trường trên Vercel:
   - `DATABASE_URL` — chuỗi kết nối Postgres
   - `SESSION_SECRET` — chuỗi ngẫu nhiên ≥ 32 ký tự
   - `APP_TIMEZONE=Asia/Ho_Chi_Minh`
2. Deploy. Lệnh build `vercel-build` tự chạy `prisma migrate deploy` trước `next build`.
3. Khởi tạo lần đầu (tạo tài khoản Admin thật, ca mặc định, ngày lễ — **không** tạo tài khoản test):
   ```bash
   npx vercel env pull .env.production.local
   npm run db:bootstrap:prod
   ```
4. Đăng nhập bằng Admin → **Quản trị**:
   - Cấu hình chấm công: thêm văn phòng (toạ độ) và/hoặc IP mạng công ty, chọn chế độ kiểm tra vị trí. Mặc định ban đầu là *không kiểm tra*.
   - Thêm phòng ban, ca làm việc, ngày lễ (Tết, Giỗ Tổ), nhân viên.

Quy ước code và quy tắc nghiệp vụ: xem [CLAUDE.md](CLAUDE.md).
