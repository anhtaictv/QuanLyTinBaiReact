# QuanLyTinBai — Hệ thống Quản lý Tin Bài

Hệ thống vận hành toàn bộ quy trình biên tập của tòa soạn: cộng tác viên (CTV) gửi bài kèm file Word, người duyệt và trưởng ban xét duyệt, bài đã duyệt có thể đưa qua Google Docs để chỉnh sửa cộng tác, và cả tòa soạn trao đổi qua chat nội bộ ngay trong hệ thống — tất cả đều được kiểm soát quyền ở backend, tự sao lưu, và tự giám sát.

- **Backend**: Node.js + Express REST API, Socket.IO, MSSQL (SQL Server)
- **Frontend**: React 18 SPA, build bằng Vite

> 🇬🇧 Bản tiếng Anh: [README.md](./README.md)

## Tính năng

**Quy trình biên tập**
- Xác thực JWT với phân quyền theo vai trò (`CTV`, `Người duyệt`, `Trưởng ban`, `Thư ký`, `Kiểm soát viên`, `Admin`)
- Gửi bài → duyệt/từ chối → khóa/mở → biên tập sửa file → duyệt cuối — kiểm tra quyền **ở backend**, không chỉ ẩn nút ở giao diện
- Upload `.doc` / `.docx` / `.pdf` (Multer, giới hạn 100MB), lưu theo cấu trúc thư mục ngày
- Tùy chọn đưa qua **Google Drive**: chuyển thành Google Doc để chỉnh sửa cộng tác, xong tự động xuất lại về `.docx`
- Xuất file `.docx` kịch bản phân cảnh từ file mẫu (`docxtemplater` + `pizzip`)
- Tìm kiếm, lọc, phân trang danh sách bài viết ở server — không kéo hết cả bảng về trình duyệt

**Cộng tác nhóm**
- Chat nội bộ (1-1 và nhóm), gửi file đính kèm, thu hồi/xóa tin nhắn — real-time qua Socket.IO, xác thực JWT ngay ở bước handshake
- Thông báo đẩy (Web Push, VAPID) khi có bài mới / được duyệt / bị từ chối
- Dashboard thống kê bài viết, người dùng (Recharts)

**Công cụ cho Admin**
- Quản lý người dùng: xem danh sách, đổi quyền, xóa
- Giám sát lỗi trực tiếp: mọi lỗi server được ghi vào database và hiển thị qua icon chuông 🚨 (số lỗi chưa đọc, xem chi tiết, đánh dấu đã đọc)
- Cảnh báo qua Telegram ngay khi có lỗi xảy ra (tùy chọn) — không cần mở app mới biết
- Kiểm tra định kỳ tích hợp Google Drive, phát hiện token hết hạn/bị thu hồi trước khi làm gián đoạn người đang duyệt bài

**Vận hành**
- `GET /api/health` cho dịch vụ theo dõi uptime bên ngoài
- Sao lưu database tự động hàng ngày, tự dọn bản cũ
- Log tự xoay vòng (theo dung lượng + hàng ngày, nén gzip), không phình đĩa
- CI chạy build + test mỗi lần push/PR; Dependabot tự cập nhật dependency

## Công nghệ sử dụng

| Tầng | Công nghệ |
|---|---|
| API | Express 4, `mssql` (Tedious), `jsonwebtoken`, `bcrypt`, `multer`, `helmet`, `express-rate-limit`, `express-validator` |
| Real-time | Socket.IO (xác thực JWT ngay ở handshake) |
| Tích hợp ngoài | Google APIs (Drive, OAuth2), `web-push`, Telegram Bot API |
| Xử lý văn bản | `docxtemplater`, `pizzip` |
| Frontend | React 18, React Router 6, Axios, Vite, `react-toastify`, `recharts`, Service Worker (push) |
| Testing | `node:test` (backend), Vitest + React Testing Library (frontend) |
| Cơ sở dữ liệu | Microsoft SQL Server |

## Cấu trúc project

```
backend/
  backend/                     # app Node/Express thật (lồng 2 lần — do lịch sử cấu trúc repo)
    config/db.js              # Kết nối pool MSSQL, tự retry khi mất kết nối
    controllers/                # auth, news, chat
    middleware/                 # authMiddleware, validators
    routes/                     # news, file, drive, push, chat, errorLog
    sockets/                    # xử lý socket cho chat
    utils/errorLogger.js        # ghi vào dbo.ErrorLogs + cảnh báo Telegram (tùy chọn)
    scripts/                    # daily-backup.js và các script bảo trì khác
    tests/                      # test viết bằng node:test
    server.js
frontend/                     # React SPA
  src/
    components/                  # ErrorBell, ChatBell, icons, ...
    hooks/                       # useIdleLogout, usePushNotification, useChatSocket, ...
    layout/MainLayout.jsx
    services/                    # api.js, newsService.js, chatService.js, ...
    views/                       # Login, Dashboard, NewsList, NewsForm, Chat, ...
  vite.config.js
```

## Phân quyền

| Vai trò | RoleID | Quyền điển hình |
|---|---|---|
| CTV | 1 | Gửi bài, xem bài của mình |
| Người duyệt | 2 | Duyệt/từ chối, biên tập sửa file |
| Trưởng ban | 3 | Duyệt/từ chối, khóa/mở bài |
| Admin | 4 | Toàn quyền, quản lý người dùng, xem log lỗi |
| Thư ký | 5 | Duyệt/từ chối |
| Kiểm soát viên | 6 | Chỉ xem |

Phân quyền được kiểm tra **ở backend** (middleware), không chỉ ẩn nút ở giao diện.

## Bắt đầu

### Yêu cầu
- Node.js 18+
- SQL Server mà backend kết nối tới được
- (Tùy chọn) Google Cloud OAuth2 credentials cho tích hợp Drive
- (Tùy chọn) VAPID keys cho Web Push (`npx web-push generate-vapid-keys`)
- (Tùy chọn) Token bot Telegram để nhận cảnh báo lỗi (tạo qua [@BotFather](https://t.me/BotFather))

### Backend

```bash
cd backend/backend
npm install
cp .env.example .env   # điền giá trị thật của bạn
npm run dev             # nodemon, hoặc: npm start
npm test                 # chạy bộ test (node:test)
```

Biến môi trường (`backend/backend/.env`) — xem đầy đủ và cập nhật nhất tại [`.env.example`](./backend/.env.example). Chỉ `DB_*` và `JWT_SECRET` là bắt buộc; phần còn lại (Google Drive, Web Push, Telegram, cấu hình backup) đều tùy chọn, bỏ trống thì tính năng liên quan tự tắt êm, không lỗi.

Không commit `.env`, `service-account.json`, `oauth-credentials.json`, `google-token.json` — các file này đã được gitignore.

### Frontend

```bash
cd backend/frontend
npm install
npm run dev      # chạy dev server (Vite, port 3000, proxy /api và /socket.io sang :5001)
npm run build    # build production vào thư mục build/
npm run preview  # xem thử bản build production
npm test           # chạy bộ test (Vitest)
```

Đặt `VITE_API_URL` (ví dụ trong `.env.production`) để SPA gọi đúng API đã deploy. Mặc định (không set) là `/api`, dùng chung origin — phù hợp khi có reverse proxy (vd IIS URL Rewrite) đứng trước.

### Database

App cần database SQL Server có các bảng `dbo.Users`, `dbo.Posts`, `dbo.PushSubscriptions`, `dbo.ErrorLogs`, và các bảng chat (xem `scripts/create-chat-tables.js`). `scripts/daily-backup.js` thực hiện `BACKUP DATABASE` đầy đủ và tự xóa backup cũ hơn `DB_BACKUP_RETENTION_DAYS` (mặc định 14 ngày) — thiết kế để chạy theo lịch (vd Windows Task Scheduler hoặc cron), vì SQL Server Express không có sẵn SQL Agent.

### Deploy

Bất kỳ môi trường có thể chạy 1 Node process lâu dài + phục vụ static SPA đều dùng được — ví dụ: PM2 (hoặc process manager khác) cho API, và 1 static file server / reverse proxy đứng trước bản build React, chuyển tiếp `/api/*` và `/socket.io/*` về Node process. `GET /api/health` sẵn sàng cho việc theo dõi uptime.

## Testing & CI

- Backend: `node --test` — middleware xác thực và các rule validate input.
- Frontend: Vitest + React Testing Library — route/auth guard và logic của hook.
- GitHub Actions chạy cả 2 bộ test (kèm build production) mỗi lần push/PR vào `main`.
- Dependabot tự tạo PR cập nhật dependency hàng tuần.

## Changelog

Xem [Releases](../../releases) để biết đầy đủ lịch sử thay đổi. Điểm nổi bật của đợt gần nhất: chuyển hẳn frontend từ Create React App sang Vite (bundle ban đầu nhỏ hơn ~66% nhờ code-split theo route), nâng driver SQL Server qua 6 major version, vá sạch mọi lỗ hổng dependency đã biết, và bổ sung toàn bộ lớp vận hành nói trên (health check, log xoay vòng, backup tự động, cảnh báo Telegram, CI, cùng bộ test tự động đầu tiên của project).

## License

Project nội bộ — chưa chỉ định license.
