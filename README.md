# Chấm công online

Web chấm công nội bộ: nhân viên check-in/check-out (xác thực GPS hoặc IP mạng công ty), quản lý duyệt đơn, HR xuất bảng công.

## Chạy lần đầu

```bash
npm install
cp .env.example .env     # điền DATABASE_URL và SESSION_SECRET
npm run db:start         # Postgres cục bộ, hoặc trỏ DATABASE_URL tới Postgres có sẵn
npm run db:migrate
npm run db:seed          # tài khoản test: xem đầu file prisma/seed.ts
npm run dev
```

Mở http://localhost:3000. Quy ước code và quy tắc nghiệp vụ: xem [CLAUDE.md](CLAUDE.md).
