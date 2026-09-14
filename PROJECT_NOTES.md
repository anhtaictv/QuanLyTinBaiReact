# Ghi chú dự án — QuanLyTinBai

> File này **không nằm trong git repo** (repo là `C:\WebApp\backend`), sống ở `C:\WebApp\PROJECT_NOTES.md` — cố tình để ngoài, vì bên dưới có domain/IP/cấu trúc hạ tầng thật, không nên public lên GitHub.
> Cập nhật lần cuối: 2026-07-08 (tới v1.4.0 — quên mật khẩu qua email).

## Tổng quan 1 phút

Hệ thống quản lý quy trình biên tập cho một tòa soạn: CTV gửi bài kèm file Word → người duyệt/trưởng ban duyệt → có thể đưa qua Google Docs sửa cộng tác → xuất lại `.docx`. Có thêm chat nội bộ, dashboard thống kê, và một lớp vận hành tự động (backup, cảnh báo, health check).

- **Repo**: `C:\WebApp\backend` — GitHub `anhtaictv/QuanLyTinBaiReact`, nhánh `main`
- **Backend**: Node/Express, chạy PM2 tên **`qltin-backend`**, port `5001`, chỉ bind `127.0.0.1`
- **Frontend**: React 18 + Vite, build tĩnh serve qua IIS site `qltin-frontend`
- **Database**: SQL Server Express (`MeoBeo\SQLEXPRESS`), database `QuanLyTinBai`
- **Domain public**: `qltb.work.gd`
- **Máy chủ**: Windows Server 2019, hostname `MEOBEO`, IP `160.191.46.223`, **chỉ 4GB RAM** (xem mục Gotcha)

## ⚠️ Có 1 backend .NET cũ, dormant, chung database — đọc trước khi đụng vào DB

Phát hiện ngày 08/07/2026: tồn tại **một bản backend .NET (ASP.NET Core + EF Core 8)** ở `C:\inetpub\wwwroot\QuanLyTinBaiAPI`, deploy lần cuối 22/04/2026 — **trước khi** dự án Node.js hiện tại được viết lại. Bằng chứng:
- Bảng `__EFMigrationsHistory` (2 migration, EF Core 8.0.12) và bảng `RefreshTokens` (55 dòng, style cột `ExpiresAtUtc`/`CreatedAtUtc` đặc trưng .NET) tồn tại trong chính database `QuanLyTinBai` mà backend Node đang dùng — **2 backend từng cùng ghi vào 1 database**.
- `appsettings.Production.json` của nó trỏ connection string y hệt: `Server=localhost\SQLEXPRESS;Database=QuanLyTinBai;User Id=sa;...`
- IIS site `QuanLyTinBaiAPI`, App Pool **đang ở trạng thái Started**, bind `*:5000`. Hiện **không có worker process nào chạy** (IIS tự tắt khi idle) nên không tốn RAM lúc này, nhưng sẽ tự bật lại nếu có request nào chạm tới port 5000.
- Không có site/proxy nào hiện tại forward traffic thật tới port 5000 — luồng traffic thật chỉ đi qua `qltb_proxy → qltin-frontend (:3000) → Node backend (:5001)`. Nên về mặt thực tế nó **dormant, không phục vụ user thật**.

**Rủi ro cần nhớ**: nếu sau này ai đó (hoặc 1 client cũ/mobile app nào đó) lỡ gọi thẳng vào port 5000, nó sẽ đọc/ghi thẳng vào cùng database production này bằng schema giả định của bản .NET — có thể lệch với schema hiện tại backend Node đang dùng (chưa audit kỹ 2 schema có đồng bộ 100% không, ví dụ bảng `RefreshTokens` không được backend Node dùng tới). An toàn nhất: nếu chắc chắn không cần bản .NET nữa, `Stop-WebAppPool QuanLyTinBaiAPI` hoặc xoá hẳn site.

## Hạ tầng triển khai thực tế

```
Internet
  │
  ▼
qltb.work.gd (IIS site "qltb_proxy", 160.191.46.223:80/443)
  │  rewrite toàn bộ request →
  ▼
127.0.0.1:3000 (IIS site "qltin-frontend", root: C:\inetpub\wwwroot\qltin)
  │  serve static build React
  │  web.config rewrite /api/* và /socket.io/* →
  ▼
127.0.0.1:5001 (PM2 process "qltin-backend", cwd: C:\WebApp\backend\backend)
  │
  ▼
localhost\SQLEXPRESS, database QuanLyTinBai
```

**Các app khác cùng chạy trên máy này** (không liên quan QuanLyTinBai, chỉ để biết khi debug RAM/CPU):
- `souldiary-api` (PM2) — `C:\Users\Administrator\Desktop\nhat-ky-fullstack\backend`
- `moodtune-backend` (PM2) — `C:\moodtune\backend`, domain `anhtaictv.me`
- `simmanager-backend` (PM2) — `C:\inetpub\wwwroot\SimManager\backend`, domain `quanlysim.work.gd`
- `pm2-logrotate` (module PM2, áp dụng cho **toàn bộ** app PM2 trên máy, không riêng gì QuanLyTinBai)

**Deploy tự động (CD) — từ 01/08/2026**: push lên `main` → CI (build+test, ubuntu-latest) chạy trước → nếu pass, workflow `deploy-windows.yml` tự chạy trên **self-hosted runner cài ngay trên VPS này** (`C:\actions-runners\qltin-vps`, Windows service `actions.runner.anhtaictv-QuanLyTinBaiReact.qltin-vps`, chạy dưới `LocalSystem` — cùng convention với runner của Soul-Diary/BaoTin). Job tự: sync code backend vào `C:\WebApp\backend\backend` (chỉ ghi đè file có trong git, không đụng `.env`/`uploads`/`node_modules`), `pm2 stop` → `npm ci` → `pm2 restart` → `pm2 save`, rồi build frontend (`npm ci` + `vite build`) và sync sang `C:\inetpub\wwwroot\qltin`. Có thể bấm chạy tay qua tab Actions (`workflow_dispatch`).

⚠️ **Gotcha đã gặp thật (01/08/2026)**: `npm ci` xoá sạch `node_modules` trước khi cài lại — nếu chạy trong lúc `qltin-backend` vẫn đang giữ file native addon (`bcrypt.node`) thì unlink lỗi `EPERM` và `node_modules` bị bỏ dở dang giữa chừng (mất cả `mssql`!). Đây là lý do bước deploy luôn `pm2 stop` **trước** `npm ci`. Nếu tự deploy tay, đừng bỏ qua bước `pm2 stop` này.

⚠️ **`pm2` CLI (`stop`/`restart`/`list`/`jlist`) bị treo vô thời hạn khi chạy qua SSH không tương tác** (named-pipe RPC tới PM2 daemon không kết nối được ngoài phiên chạy runner-service/desktop) — đã xác nhận thật trên máy này. Vì vậy **không dùng SSH để tự động deploy được**, phải dùng self-hosted runner (chạy như Windows service, cùng phiên với daemon) như trên. Nếu cần restart pm2 thủ công mà CLI treo: tìm PID đang nghe port qua `Get-NetTCPConnection -LocalPort 5001`, `Stop-Process -Force` PID đó — PM2 daemon sẽ tự động restart app (đã kiểm chứng), nhưng **không** dùng cách này để "stop rồi cài dependency" vì PM2 sẽ auto-restart gần như ngay lập tức, dễ tái diễn đúng lỗi `EPERM` ở trên.

**Deploy thủ công (dự phòng, nếu runner service bị tắt)**:
```powershell
cd C:\WebApp\backend\backend
git pull
pm2 stop qltin-backend
npm ci
pm2 restart qltin-backend --update-env

cd ..\frontend
npm ci
npx vite build
# backup bản cũ trước khi ghi đè (xem C:\WebApp\frontend_backups\ để biết convention đặt tên)
Copy-Item -Recurse build\* C:\inetpub\wwwroot\qltin\ -Force
```

**Chứng chỉ TLS**: tự động renew qua `win-acme` (Task Scheduler "win-acme renew"), cert hiện tại hết hạn 11/08/2026, tự gia hạn không cần làm gì.

## Database

- Server: `localhost\SQLEXPRESS` (SQL Server 2022 Express)
- Database: `QuanLyTinBai`
- Đăng nhập: `sa` (SQL Auth) — mật khẩu trong `.env` (`DB_PASSWORD`), **không phải** Windows Auth
- 13 bảng: `Users` (nay 9 cột, có thêm `Email` từ 08/07), `Posts` (14), `PushSubscriptions` (5), `ErrorLogs` (9), `Conversations` (6), `ConversationMembers` (7), `Messages` (12), `MessageAttachments` (7), `MessageHiddenFor` (3), `PasswordResetTokens` (6, mới 08/07 — `ResetID, UserID, TokenHash, ExpiresAt, Used, CreatedAt`), cộng 2 bảng rác từ .NET cũ (`__EFMigrationsHistory`, `RefreshTokens` — bỏ qua, backend Node không đụng tới, **đừng nhầm** với `PasswordResetTokens` mới của Node)
- ⚠️ **Gotcha múi giờ đã gặp thật**: cột nào ghi giờ từ Node (`new Date()`, luôn là UTC) mà so sánh với `GETDATE()` trong SQL (giờ local server, UTC+7) sẽ lệch 7 tiếng. `PasswordResetTokens.ExpiresAt` từng bị bug này (mọi token coi như hết hạn ngay lúc tạo) — đã fix dùng `GETUTCDATE()`. Các cột `GETDATE()` khác trong code đều do chính SQL Server tự set VÀ tự so sánh nên không bị ảnh hưởng — chỉ cẩn thận khi Node ghi giờ rồi SQL so sánh.
- Backup tự động: Windows Task Scheduler **"QuanLyTinBai-DailyBackup"** chạy `scripts/daily-backup.js` lúc 2h sáng mỗi ngày, output vào `C:\WebApp\db_backups\`, tự xoá bản cũ hơn 14 ngày (`DB_BACKUP_RETENTION_DAYS`)
- Backup thủ công cũ hơn (trước khi có script tự động) cũng nằm trong `C:\WebApp\db_backups\`, đặt tên theo convention `QuanLyTinBai_<mô-tả>_<timestamp>..bak`

## Biến môi trường (`backend/backend/.env`)

Xem file thật nhất tại [`backend/.env.example`](./backend/.env.example) trong repo — chỉ liệt kê nhanh ở đây các nhóm:

| Nhóm | Biến | Bắt buộc? |
|---|---|---|
| DB | `DB_USER`, `DB_PASSWORD`, `DB_SERVER`, `DB_NAME` | Có |
| Auth | `JWT_SECRET` | Có |
| Storage | `STORAGE_ROOT` | Có (mặc định `./uploads`) |
| Google Drive | `GOOGLE_DRIVE_FOLDER_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Tuỳ chọn — token thật nằm ở `google-token.json` (ưu tiên đọc file này nếu có, xem `driveRoutes.js:loadToken()`), `.env` chỉ là fallback |
| Web Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` | Tuỳ chọn |
| Telegram alert | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Tuỳ chọn — bot `@DavisQLTB_bot`, chat_id hiện trỏ về Mèo Béo Tạ |
| Backup | `DB_BACKUP_DIR`, `DB_BACKUP_RETENTION_DAYS` | Tuỳ chọn, có default trong code |
| Email "Quên mật khẩu" | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `FRONTEND_URL` | Tuỳ chọn (nhưng thiếu thì tính năng forgot-password lỗi khi gọi thật) — Gmail `anhtaictv@gmail.com`, App Password tạo tại myaccount.google.com/apppasswords (không phải mật khẩu Gmail thường), `FRONTEND_URL=https://qltb.work.gd` dùng để build link trong email |

`GOOGLE_SERVICE_ACCOUNT_PATH` từng có trong `.env.example` nhưng **không được code nào dùng** — đã xoá khỏi `.env.example` ngày 08/07. Tích hợp Drive thực tế 100% qua OAuth2 (`google-token.json`), không dùng service account.

## Google Drive OAuth — biết trước khi cần cấp lại quyền

- OAuth consent screen của Google Cloud project (`jovial-duality-425316-i9`) **đã publish sang Production** (theo xác nhận của chủ dự án) — token không còn tự hết hạn sau ~7 ngày như lúc còn ở Testing.
- Nếu vẫn cần cấp lại quyền (`node getToken.js`): script dùng flow **loopback** (RFC 8252), tự mở 1 HTTP server tạm trên `localhost:<port random>`, in ra URL — **phải mở URL đó trên chính trình duyệt của máy Windows Server này** (qua RDP), không mở được từ máy khác vì redirect chỉ về được `localhost` của máy đang chạy script. Google sẽ tự động gọi lại server đó, không cần copy-paste code thủ công (flow `oob` cũ **đã bị Google chặn**, báo `invalid_request`).
- Nếu Google báo "Access blocked" / "Authorization Error" lúc cấp quyền: kiểm tra tài khoản đang đăng nhập có nằm trong **Test users** của OAuth consent screen chưa (Google Cloud Console → APIs & Services → OAuth consent screen → Audience/Test users).
- Có health-check tự động mỗi 6 tiếng (`driveRoutes.js`) gọi `drive.about.get()` — nếu token hỏng sẽ tự ghi vào `ErrorLogs` + bắn cảnh báo Telegram, không cần tự kiểm tra thủ công.

## Danh sách API

Base path `/api`. Route có `verifyToken` nghĩa là cần JWT hợp lệ (header `Authorization: Bearer <token>`).

**Công khai** (không cần token)
- `GET /health` — health check cho uptime monitor, kiểm tra cả kết nối DB
- `POST /login`, `POST /register` — có rate-limit riêng (8 req/15 phút + burst 4 req/phút), có khoá tạm 5 lần sai/tài khoản (15 phút)
- `POST /forgot-password` `{Username, Email}` — luôn trả cùng 1 message chung (chống dò tài khoản), chỉ gửi email nếu khớp cả 2. `POST /reset-password` `{token, newPassword}` — token 32 byte random, chỉ lưu SHA-256 hash trong DB, hạn 30 phút UTC, dùng 1 lần. Cả 2 qua chung rate-limit với login/register.

**Cần token** (mọi route dưới `/api` còn lại đều qua `apiLimiter`: 600 req/5 phút chung)
- `POST /change-password`, `POST /refresh-token`, `GET /profile/email` `PUT /profile/email` (tự xem/cập nhật email của chính mình)
- `GET /users/basic` (danh sách rút gọn, mọi role), `GET /users` `PUT /users/:id/role` `DELETE /users/:id` (Admin only)
- `/news/*` — xem `routes/newsRoutes.js`: CRUD bài viết, `PUT /:id/status` (duyệt/từ chối, cần role), `POST /:id/lock` (khoá/mở, cần role), `POST /:id/editor-approve`, `POST /news/:id/export-storyboard` (xuất `.docx` từ template)
- `/file/*` — upload/download file đính kèm bài viết (`.doc/.docx/.pdf`, giới hạn 100MB)
- `/drive/*` — `POST /upload` (đưa file lên Drive), `POST /complete/:id` (lấy về + duyệt), `GET /status/:id`
- `/push/*` — đăng ký/huỷ Web Push, lấy VAPID public key
- `/errors/*` — Admin only, cho ErrorBell (unread-count, list, mark-as-read)
- `/chat/*` — conversations, messages (gửi/sửa/thu hồi/xoá-cho-mình), file đính kèm (ảnh/PDF, 20MB), members nhóm

**Socket.IO** (namespace mặc định, JWT xác thực ngay tại handshake — xem `sockets/chatSocket.js`)

## Cấu trúc thư mục

```
C:\WebApp\
  backend\                    ← git repo (anhtaictv/QuanLyTinBaiReact)
    backend\                  ← Node/Express app thật (lồng 2 lần, lịch sử để lại)
      config/                 db.js (pool + retry), chatUpload.js (multer cho chat)
      controllers/            authController, newsController, chatController
      middleware/             authMiddleware (verifyToken/isAdmin/requireRoles), validators (express-validator)
      routes/                 news, file, drive, push, chat, errorLog
      sockets/                chatSocket.js, ioHolder.js, socketRegistry.js
      scripts/                daily-backup.js, create-chat-tables.js, backup-and-migrate.js (cũ)
      tests/                  node:test — authMiddleware, validators
      utils/errorLogger.js    ghi ErrorLogs + gửi Telegram
      getToken.js             lấy/refresh OAuth token cho Drive (chạy tay khi cần)
      server.js               entrypoint
    frontend\                 React 18 + Vite
      src/
        views/                Login, Dashboard, NewsList, NewsForm, PostDetail, DocEditor, Chat, UserManagement, Permissions, ChangePassword
        components/           ErrorBell, ChatBell, icons.jsx (tự vẽ SVG, không dùng icon lib ngoài), chat/*
        hooks/                useIdleLogout (10 phút), useSessionRefresh (mới, 20 phút), usePushNotification, useChatSocket, useDropdownPosition
        layout/MainLayout.jsx sidebar + topbar + các hook session ở trên
        services/              api.js (axios instance + interceptor auth/401), newsService, chatService, errorLogService
      vite.config.js          proxy /api, /socket.io -> :5001 lúc dev
    .github/
      workflows/ci.yml               build+test cả 2 phía mỗi push/PR vào main (ubuntu-latest)
      workflows/deploy-windows.yml   CD tự động, chạy sau khi ci.yml pass trên main (self-hosted runner)
      dependabot.yml          weekly, group minor+patch
  backups\                    backup frontend build cũ (thủ công, trước khi có convention frontend_backups)
  db_backups\                 backup .bak database (tự động + thủ công cũ)
  frontend_backups\           backup build frontend trước mỗi lần deploy lớn (đặt tên qltin_<lý-do>_<timestamp>)
```

**Runner CI/CD** (ngoài `C:\WebApp\`, cùng chỗ với runner của các app khác): `C:\actions-runners\qltin-vps\` — self-hosted GitHub Actions runner riêng cho repo này, Windows service `actions.runner.anhtaictv-QuanLyTinBaiReact.qltin-vps`, chạy dưới `LocalSystem`. Các app khác trên máy cũng có runner riêng theo cùng convention (`C:\actions-runners\souldiary-vps\`, `C:\actions-runner\` cho repo BaoTin).

## Vận hành tự động đang bật

- **Backup DB**: Task Scheduler, 2h sáng hàng ngày, giữ 14 ngày
- **PM2 log rotation**: 10MB/file, giữ 30 bản, nén gzip, xoay lúc 0h — áp dụng toàn bộ app PM2 trên máy
- **Cảnh báo Telegram**: mọi lỗi qua `logError()` (500 lỗi server, Drive token hỏng...) tự bắn qua bot `@DavisQLTB_bot`
- **Health check Drive**: mỗi 6 tiếng, tự phát hiện token hỏng
- **CI/CD**: GitHub Actions build+test mỗi push/PR vào `main`; nếu pass, tự deploy qua self-hosted runner `qltin-vps` (xem mục "Deploy tự động" ở trên)
- **Dependabot**: tự tạo PR cập nhật dependency hàng tuần cho cả 2 phía

## Testing

- Backend: `cd backend/backend && npm test` (`node --test`, 14 test — authMiddleware, validators)
- Frontend: `cd backend/frontend && npm test` (Vitest + RTL, 5 test — routing guard, useDropdownPosition)
- Không có test cho: controllers (news/chat/auth business logic), socket handlers, React component rendering ngoài App/hook đã test

## Lịch sử phiên bản (Git tags / GitHub Releases)

| Tag | Ngày (release được tạo) | Nội dung chính |
|---|---|---|
| v1.0.0 | (backfill) | Khởi tạo |
| v1.1.0 | (backfill) | Vá lỗ hổng phân quyền, sửa bug template/storage |
| v1.2.0 | (backfill) | Chat nội bộ, giám sát lỗi Admin |
| v1.3.0 | 08/07/2026 | Vite migration, MSSQL driver v6→v12, helmet/rate-limit/validator, Telegram/backup/health-check tự động, phân trang |
| v1.3.1 | 08/07/2026 | Fix rò rỉ file chat khi thu hồi tin nhắn, JWT silent refresh |
| v1.4.0 | 08/07/2026 | Quên mật khẩu qua email thật (Gmail SMTP) |

v1.0–1.2 được tạo bù ngày 08/07 (gắn đúng vào commit lịch sử) vì repo trước đó chưa từng có Release nào trên GitHub dù `package.json` đã lên tới 1.2.0 từ lâu. v1.3.1 cũng suýt bị bỏ sót tương tự (chỉ bump version + push, quên `gh release create`) — nếu thấy version `package.json` cao hơn tag mới nhất trên GitHub, khả năng cao là quên bước này, backfill bằng `gh release create v<x> --target <full-commit-sha>` (**bắt buộc full SHA**, short SHA báo lỗi `target_commitish is invalid`). Sau khi tạo release cũ hơn, nhớ `gh release edit v<mới nhất> --latest` vì GitHub tự đánh dấu "Latest" theo thời điểm bấm tạo, không theo số bản.

## Việc đã làm ngày 07–08/07/2026 (đợt nâng cấp lớn nhất từ trước đến nay)

Tóm tắt, chi tiết xem commit log / Release notes trên GitHub:
1. Driver `mssql` 6→12, vá toàn bộ `npm audit`
2. Migrate frontend CRA → Vite, `createRoot`, code-split (bundle chính -66%)
3. Fix Google Drive OAuth (flow `oob` bị Google chặn → chuyển loopback), cấp lại token
4. helmet, rate-limit toàn `/api`, express-validator, Dependabot
5. Cảnh báo Telegram, backup DB tự động, PM2 log rotation, `GET /api/health`
6. Phân trang/tìm kiếm `/news` chuyển ra server
7. Backfill Git Release v1.0–1.3, viết lại README song ngữ
8. Xoá file đính kèm vật lý khi thu hồi tin nhắn chat (đóng luôn 1 đường vòng tải file đã thu hồi qua URL trực tiếp)
9. JWT silent refresh (`POST /api/refresh-token`, frontend tự gọi mỗi 20 phút khi đang hoạt động) — chống văng session giữa chừng khi làm việc dài
10. Dọn `GOOGLE_SERVICE_ACCOUNT_PATH` chết trong `.env.example`
11. Quên mật khẩu qua email thật (Gmail SMTP + App Password) — thêm `Users.Email`, bảng `PasswordResetTokens`, banner nhắc user cũ bổ sung email. Bug tự phát hiện trước khi deploy: token hết hạn so sánh nhầm `GETDATE()` (local, UTC+7) thay vì `GETUTCDATE()` khiến mọi token coi như hết hạn ngay lúc tạo — đã fix và test lại kỹ trước khi lên production.

## Gotcha / lưu ý khi debug

- **RAM 4GB, thường xuyên ~90%+**: SQL Server thỉnh thoảng phản hồi chậm/timeout kết nối mới khi RAM căng (biểu hiện: log `Login failed for user 'sa'` hoặc `Failed to connect ... in 15000ms` dồn dập vài phút rồi tự hết). `config/db.js` đã có retry-with-backoff nên **không làm sập server**, chỉ delay. Đừng hoảng khi thấy log này — kiểm tra `Get-Process | Sort WorkingSet64` trước khi nghi ngờ code.
- **`gh` CLI hay hết hạn token** trên máy này — nếu lệnh `gh` báo 401, chạy `gh auth login --hostname github.com --git-protocol https --web` và làm theo device-code flow.
- **`npm audit fix` không tự sync `node_modules`** nếu bản cũ vẫn thoả mãn range `^` trong `package.json` — phải `npm install <pkg>@<version>` đích danh để chắc chắn bản vá thực sự được nạp (đã gặp ở đợt vá mssql/express/multer).
- **Windows Credential Manager / `git push` có thể treo** nếu đang chờ popup đăng nhập GitHub trên desktop mà agent không thấy được — nếu `git push` treo quá 2 phút, khả năng cao là đang chờ tương tác người dùng trên màn hình thật.
- **PM2 process test tạm**: nếu mở server Node phụ để test (`PORT=5099 node server.js &`), nhớ tắt bằng `Stop-Process -Id <pid>` sau khi xong, đừng để treo — từng nhầm lẫn hiện tượng SQL chậm do RAM với "rò rỉ kết nối" vì kill nhầm bằng `-Force` giữa chừng.

## Ý tưởng chưa làm (đúng lúc dừng lại 08/07)

- Dashboard vẫn là chunk nặng nhất (347KB, do `recharts`) — đã ở route riêng (lazy) nên lợi ích tách thêm không nhiều, chưa làm.
- Chưa có test cho business logic ở controllers (chỉ có middleware/validator).
- Cân nhắc dừng hẳn (hoặc gỡ) app pool `QuanLyTinBaiAPI` (.NET cũ) nếu chắc chắn không cần nữa — xem mục cảnh báo ở đầu file.
- RAM 4GB là nút thắt tiềm ẩn dài hạn nếu traffic/số app trên máy tăng thêm.
- Admin chưa có UI để xem/sửa Email của user khác (chỉ tự user mới sửa được email của chính mình qua trang Đổi mật khẩu) — nếu 1 user quên cả Username lẫn chưa từng set Email, chỉ Admin can thiệp trực tiếp DB mới cứu được.
