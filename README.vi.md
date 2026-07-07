# QuanLyTinBai — Hệ thống Quản lý Tin Bài

Hệ thống quản lý quy trình biên tập cho tòa soạn: cộng tác viên (CTV) gửi bài kèm file Word, người duyệt/trưởng ban xét duyệt, bài được duyệt có thể đưa qua Google Docs để chỉnh sửa cộng tác trước khi lưu lại vào hệ thống.

- **Backend**: Node.js + Express REST API, MSSQL (SQL Server)
- **Frontend**: React 18 SPA (Vite)

> 🇬🇧 Bản tiếng Anh: [README.md](./README.md)

## Tính năng

- **Xác thực JWT** với phân quyền theo vai trò (`CTV`, `Người duyệt`, `Trưởng ban`, `Thư ký`, `Kiểm soát viên`, `Admin`)
- **Quy trình biên tập**: gửi bài → duyệt/từ chối → khóa/mở → biên tập sửa file → duyệt cuối, tất cả được kiểm tra quyền ở backend (không chỉ ẩn nút ở giao diện)
- **Quản lý file**: upload `.doc` / `.docx` / `.pdf` (Multer), lưu theo cấu trúc thư mục ngày, có thể đưa qua **Google Drive** để chuyển thành Google Doc chỉnh sửa cộng tác rồi xuất lại về `.docx`
- **Xuất file Word**: tạo file `.docx` kịch bản phân cảnh từ file mẫu (`docxtemplater` + `pizzip`)
- **Thông báo đẩy (Web Push)** qua VAPID khi có bài mới / được duyệt / bị từ chối
- **Dashboard** thống kê bài viết, người dùng (`recharts`)
- **Quản lý người dùng**: xem danh sách, đổi quyền, xóa (chỉ Admin)
- **Giám sát lỗi cho Admin**: mọi lỗi server (HTTP 500) tự động được ghi vào database và hiển thị qua icon chuông 🚨 trên thanh điều hướng (số lỗi chưa đọc, xem chi tiết, đánh dấu đã đọc)

## Công nghệ sử dụng

| Tầng | Công nghệ |
|---|---|
| API | Express 4, `mssql` (Tedious), `jsonwebtoken`, `bcrypt`, `multer`, `express-rate-limit` |
| Tích hợp ngoài | Google APIs (Drive, OAuth2), `web-push` |
| Xử lý văn bản | `docxtemplater`, `pizzip`, `mammoth`, `html-docx-js` |
| Frontend | React 18, React Router 6, Axios, `react-toastify`, `recharts`, Service Worker (push) |
| Cơ sở dữ liệu | Microsoft SQL Server |

## Cấu trúc project

```
backend/
  backend/
    config/db.js            # Kết nối pool MSSQL
    controllers/             # authController, newsController
    middleware/authMiddleware.js
    routes/                  # news, file, drive, push, errorLog
    utils/errorLogger.js     # ghi lỗi vào dbo.ErrorLogs
    scripts/                 # script chạy 1 lần (migration, bảo trì)
    server.js
  frontend/
    src/
      components/ErrorBell.jsx
      hooks/                 # useIdleLogout, usePushNotification
      layout/MainLayout.jsx
      services/              # api.js, newsService.js, errorLogService.js
      views/                 # Login, Dashboard, NewsList, NewsForm, ...
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

### Backend

```bash
cd backend/backend
npm install
cp .env.example .env   # điền giá trị thật của bạn
npm run dev            # nodemon, hoặc: npm start
```

Các biến môi trường cần có (`backend/backend/.env`):

```
PORT=5001
DB_USER=...
DB_PASSWORD=...
DB_SERVER=...
DB_NAME=QuanLyTinBai
JWT_SECRET=...
STORAGE_ROOT=./uploads
GOOGLE_SERVICE_ACCOUNT_PATH=./service-account.json
GOOGLE_DRIVE_FOLDER_ID=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=...
```

Không commit `.env`, `service-account.json`, `oauth-credentials.json`, `google-token.json` — các file này đã được gitignore.

### Frontend

```bash
cd backend/frontend
npm install
npm run dev      # chạy dev server (Vite, port 3000, proxy /api và /socket.io sang :5001)
npm run build    # build production vào thư mục build/
npm run preview  # xem thử bản build đã production
```

Đặt `VITE_API_URL` (ví dụ trong `.env.production`) để SPA gọi đúng API đã deploy. Mặc định (không set) là `/api`, dùng chung origin — phù hợp khi có reverse proxy (IIS URL Rewrite) đứng trước.

### Database

App cần database SQL Server có các bảng `dbo.Users`, `dbo.Posts`, `dbo.PushSubscriptions`, `dbo.ErrorLogs`. File `backend/backend/scripts/backup-and-migrate.js` là script mẫu để backup database và tạo bảng `ErrorLogs` nếu chưa có.

### Deploy

Bất kỳ môi trường có thể chạy 1 Node process lâu dài + phục vụ static SPA đều dùng được — ví dụ: PM2 (hoặc process manager khác) cho API, và 1 static file server / reverse proxy đứng trước bản build React, rewrite `/api/*` về Node process.

## Các cập nhật gần đây (changelog)

Đã thực hiện một lượt rà soát bảo mật/bảo trì gồm:

**Sửa lỗi bảo mật & bug**
- Thêm middleware `requireRoles()` ở backend — các hành động duyệt/từ chối, khóa/mở, editor-approve trước đây chỉ bị ẩn ở giao diện nhưng *bất kỳ* user đăng nhập nào vẫn gọi API trực tiếp được; giờ đã kiểm tra quyền ngay tại API.
- `AuthorID` của bài viết mới giờ lấy từ JWT đã xác thực thay vì tin trường client gửi lên (chặn giả mạo tác giả).
- Sửa lỗi sai đường dẫn file trong endpoint xuất Word (`exportNewsWord`) — trước đây luôn tìm vào thư mục không tồn tại.
- `STORAGE_ROOT` giờ thực sự đọc từ `.env` ở các route file/Drive (trước đây bị hard-code, bỏ qua cấu hình).
- Tham số hoá 1 câu SQL `IN (...)` trước đây nối chuỗi trực tiếp.
- Bỏ middleware CORS thủ công trùng lặp quá rộng, và 1 cờ cấu hình TLS chết/không an toàn.
- Thêm rate limit cho `/api/login` và `/api/register` để hạn chế brute-force.

**Bảo trì dependency**
- Nâng `express` và `dotenv` lên bản hiện tại trong cùng major (không phá vỡ tương thích).
- Xóa 1 dependency rác/lỗi tên không dùng tới (`rechart`).

**Mới: giám sát lỗi cho Admin**
- Mọi lỗi phía server giờ được ghi vào bảng `dbo.ErrorLogs` kèm nguồn lỗi, message, stack trace, user, method, path.
- API mới `/api/errors` (chỉ Admin) cho xem số lỗi chưa đọc, danh sách, đánh dấu đã đọc.
- Component `ErrorBell` mới hiển thị badge số lỗi chưa đọc ngay trên giao diện, tự poll mỗi 30 giây, có panel chi tiết và toast cảnh báo khi có lỗi mới.

## License

Project nội bộ — chưa chỉ định license.
