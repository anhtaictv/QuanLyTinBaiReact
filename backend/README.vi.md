<div align="center">
  <img src="docs/logo-banner.jpg" alt="Logo Quản Lý Tin Bài" width="200" />

  # QuanLyTinBai
  ### Hệ thống Quản lý Tin Bài

  *Uy tín · Chính xác · Kịp thời*

  [![CI](https://github.com/anhtaictv/QuanLyTinBaiReact/actions/workflows/ci.yml/badge.svg)](https://github.com/anhtaictv/QuanLyTinBaiReact/actions/workflows/ci.yml)
  [![Release](https://img.shields.io/github/v/release/anhtaictv/QuanLyTinBaiReact)](https://github.com/anhtaictv/QuanLyTinBaiReact/releases)
  [![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
  [![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
  [![License](https://img.shields.io/badge/license-Private-lightgrey)](#license)

  🇬🇧 [English](./README.md)
</div>

---

Hệ thống vận hành toàn bộ quy trình biên tập của tòa soạn: cộng tác viên (CTV) gửi bài kèm file Word, người duyệt và trưởng ban xét duyệt, bài đã duyệt có thể đưa qua Google Docs để chỉnh sửa cộng tác, và cả tòa soạn trao đổi qua chat nội bộ ngay trong hệ thống. Bên cạnh quy trình đó, hệ thống có thêm **trợ lý AI** hỗ trợ biên tập, phân loại, rà soát nội dung và tra cứu quy định, cùng **tính năng tổng hợp tin địa phương** tự động giúp tòa soạn nắm bắt tin tức liên quan tới địa bàn — tất cả đều được kiểm soát quyền ở backend, tự sao lưu, và tự giám sát.

- **Backend**: Node.js + Express REST API, Socket.IO, MSSQL (SQL Server)
- **Frontend**: React 18 SPA, build bằng Vite
- **AI**: Ưu tiên chạy cục bộ qua **AI Gateway** dùng chung (Ollama tự triển khai, tự chuyển sang model đám mây khi không kết nối được) — tùy chọn, tự tắt êm nếu chưa cấu hình

## Mục lục

- [Tính năng](#tính-năng)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc project](#cấu-trúc-project)
- [Phân quyền](#phân-quyền)
- [Bắt đầu](#bắt-đầu)
- [Testing & CI](#testing--ci)
- [Changelog](#changelog)
- [License](#license)

## Tính năng

**Quy trình biên tập**
- Xác thực JWT với phân quyền theo vai trò (`CTV`, `Người duyệt`, `Trưởng ban`, `Thư ký`, `Kiểm soát viên`, `Admin`)
- Gửi bài → duyệt/từ chối → khóa/mở → biên tập sửa file → duyệt cuối — kiểm tra quyền **ở backend**, không chỉ ẩn nút ở giao diện
- Upload `.doc` / `.docx` / `.pdf` (Multer, giới hạn 100MB), lưu theo cấu trúc thư mục ngày
- Tùy chọn đưa qua **Google Drive**: chuyển thành Google Doc để chỉnh sửa cộng tác, xong tự động xuất lại về `.docx`
- Xuất file `.docx` kịch bản phân cảnh từ file mẫu (`docxtemplater` + `pizzip`)
- Tìm kiếm, lọc, phân trang danh sách bài viết ở server — không kéo hết cả bảng về trình duyệt

**Trợ lý AI** (`/api/ai/*` — mặc định tắt, không bao giờ chặn nghiệp vụ nếu chưa cấu hình)
- **Trợ lý biên tập**: sửa lỗi chính tả/ngữ pháp, chuẩn hóa văn phong theo chuẩn báo chí, gợi ý 5 phương án tiêu đề, tóm tắt đoạn Sapo — kết quả luôn hiển thị để xem trước, biên tập viên tự chọn áp dụng hay bỏ qua
- **Phân loại & gắn tag tự động**: gợi ý đúng chuyên mục có sẵn và trích xuất các thực thể quan trọng (tên người, địa danh, cơ quan/tổ chức) làm tag tham khảo, bấm là áp dụng
- **Kiểm duyệt & bảo mật thông tin**: trước khi gửi bài, nội dung được quét bằng hai lớp — quét mẫu (regex) nhận diện số CCCD, số điện thoại, biển số xe (chạy được cả khi AI cục bộ chưa kết nối) và AI rà soát từ ngữ có thể vi phạm quy định biên tập; biên tập viên tự quyết định gửi tiếp hay quay lại sửa
- **Tra cứu quy định (RAG)**: Admin/Trưởng ban/Thư ký nạp văn bản quy định, quy chế biên tập, luật báo chí vào kho tri thức nội bộ; biên tập viên hỏi - đáp bằng ngôn ngữ tự nhiên, câu trả lời chỉ dựa trên đúng nội dung đã nạp kèm trích dẫn nguồn — không tự suy diễn
- **Trợ lý hỏi đáp tự do**: màn hình chat AI để hỏi đáp tự do ngoài quy trình biên tập, luôn ép trả lời bằng tiếng Việt bất kể câu hỏi đặt bằng ngôn ngữ gì
- Mọi request đều đi qua **AI Gateway** dùng chung (`aiGatewayClient.js`, theo đúng hợp đồng OpenAI `/v1/chat/completions` + `/v1/embeddings`) — gateway tự thử máy Ollama tự triển khai trước, chuyển sang model đám mây khi không tới được; app không bao giờ gọi thẳng Ollama hay nhà cung cấp đám mây; mọi route AI trả về `503` gọn gàng khi gateway không kết nối được, thay vì làm lỗi cả request

**Tổng hợp tin địa phương** (`/api/news-digest/*`)
- Định kỳ lấy tin từ RSS các báo lớn trong nước cộng thêm nguồn tìm kiếm Google Tin tức, lọc lấy tin liên quan tới địa bàn tòa soạn phụ trách, lưu lại để cả nhóm theo dõi
- Chống trùng 2 lớp: trùng link chính xác (ở tầng database) và so khớp theo tiêu đề đã chuẩn hóa, để cùng 1 tin lấy từ 2 nguồn khác nhau (hoặc báo đăng lại) không hiện 2 lần
- Chạy theo lịch (task scheduler/cron bên ngoài, vì SQL Server Express không có sẵn SQL Agent) hoặc bấm "Cập nhật ngay" cho Admin/Trưởng ban/Thư ký

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
- CI chạy build + test mỗi lần push/PR; tự động deploy khi push lên `main` qua self-hosted runner; Dependabot tự cập nhật dependency

## Công nghệ sử dụng

| Tầng | Công nghệ |
|---|---|
| API | Express 4, `mssql` (Tedious), `jsonwebtoken`, `bcrypt`, `multer`, `helmet`, `express-rate-limit`, `express-validator` |
| Real-time | Socket.IO (xác thực JWT ngay ở handshake) |
| AI | **AI Gateway** dùng chung (chuẩn OpenAI) đứng trước [Ollama](https://ollama.com) tự triển khai, tự chuyển sang model đám mây khi cần, kho vector dạng file JSON tìm bằng cosine similarity cho RAG |
| Tổng hợp tin | `rss-parser` (RSS báo chí + RSS tìm kiếm Google Tin tức) |
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
    controllers/                # auth, news, chat, ai, rag, newsDigest
    middleware/                 # authMiddleware, validators
    routes/                     # news, file, drive, push, chat, errorLog, ai, newsDigest
    services/                   # aiGatewayClient.js, ragStore.js (kho vector JSON)
    sockets/                    # xử lý socket cho chat
    utils/errorLogger.js        # ghi vào dbo.ErrorLogs + cảnh báo Telegram (tùy chọn)
    scripts/                    # daily-backup.js, fetch-news-digest.js và các script bảo trì khác
    tests/                      # test viết bằng node:test
    server.js
frontend/                     # React SPA
  src/
    components/                  # ErrorBell, ChatBell, AIBell, ai/ (panel biên tập, gợi ý phân loại, cảnh báo dữ liệu nhạy cảm), icons, ...
    hooks/                       # useIdleLogout, usePushNotification, useChatSocket, ...
    layout/MainLayout.jsx
    services/                    # api.js, newsService.js, chatService.js, aiService.js, ...
    views/                       # Login, Dashboard, NewsList, NewsForm, Chat, NewsDigest, AIKnowledge, ...
  vite.config.js
```

## Phân quyền

| Vai trò | RoleID | Quyền điển hình |
|---|---|---|
| CTV | 1 | Gửi bài, xem bài của mình |
| Người duyệt | 2 | Duyệt/từ chối, biên tập sửa file |
| Trưởng ban | 3 | Duyệt/từ chối, khóa/mở bài |
| Admin | 4 | Toàn quyền, quản lý người dùng, xem log lỗi |
| Thư ký | 5 | Chỉ xử lý bài đã duyệt (lưu trữ/xuất bản) — không thấy/không duyệt được bài đang chờ duyệt |
| Kiểm soát viên | 6 | Xem toàn bộ bài viết (mọi trạng thái), không duyệt/khóa/sửa |

Phân quyền được kiểm tra **ở backend** (middleware), không chỉ ẩn nút ở giao diện. Riêng việc quản lý kho tri thức RAG (nạp/xóa văn bản quy định) chỉ dành cho Admin / Trưởng ban / Thư ký.

## Bắt đầu

### Yêu cầu
- Node.js 18+
- SQL Server mà backend kết nối tới được
- (Tùy chọn) Google Cloud OAuth2 credentials cho tích hợp Drive
- (Tùy chọn) VAPID keys cho Web Push (`npx web-push generate-vapid-keys`)
- (Tùy chọn) Token bot Telegram để nhận cảnh báo lỗi (tạo qua [@BotFather](https://t.me/BotFather))
- (Tùy chọn) Một **AI Gateway** kết nối được (`AI_GATEWAY_URL` + `AI_GATEWAY_API_KEY`, chuẩn OpenAI `/v1/chat/completions` + `/v1/embeddings`) để dùng các tính năng trợ lý AI; nếu không, các route đó chỉ trả về `503`

### Backend

```bash
cd backend/backend
npm install
cp .env.example .env   # điền giá trị thật của bạn
npm run dev             # nodemon, hoặc: npm start
npm test                 # chạy bộ test (node:test)
```

Biến môi trường (`backend/backend/.env`) — xem đầy đủ và cập nhật nhất tại [`.env.example`](./backend/.env.example). Chỉ `DB_*` và `JWT_SECRET` là bắt buộc; phần còn lại (Google Drive, Web Push, Telegram, cấu hình backup, `AI_GATEWAY_*`) đều tùy chọn, bỏ trống thì tính năng liên quan tự tắt êm — riêng route AI trả về `503` kèm `connected: false`, không làm lỗi phần còn lại của app.

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

App cần database SQL Server có các bảng `dbo.Users`, `dbo.Posts`, `dbo.PushSubscriptions`, `dbo.ErrorLogs`, `dbo.NewsDigestItems` (xem `scripts/create-news-digest-table.js`), và các bảng chat (xem `scripts/create-chat-tables.js`). `scripts/daily-backup.js` thực hiện `BACKUP DATABASE` đầy đủ và tự xóa backup cũ hơn `DB_BACKUP_RETENTION_DAYS` (mặc định 14 ngày) — thiết kế để chạy theo lịch (vd Windows Task Scheduler hoặc cron), vì SQL Server Express không có sẵn SQL Agent. `scripts/fetch-news-digest.js` chạy việc tổng hợp tin RSS theo cách tương tự.

### Deploy

Bất kỳ môi trường có thể chạy 1 Node process lâu dài + phục vụ static SPA đều dùng được — ví dụ: PM2 (hoặc process manager khác) cho API, và 1 static file server / reverse proxy đứng trước bản build React, chuyển tiếp `/api/*` và `/socket.io/*` về Node process. `GET /api/health` sẵn sàng cho việc theo dõi uptime. CI/CD của chính repo này (`.github/workflows/deploy-windows.yml`) tự động deploy mỗi lần push lên `main` sau khi CI pass, qua self-hosted GitHub Actions runner.

## Testing & CI

- Backend: `node --test` — middleware xác thực, các rule validate input, hành vi của AI Gateway client, xử lý hội thoại AI, và các hàm xử lý text của tổng hợp tin (khớp từ khóa, chống trùng, cắt gọn tóm tắt).
- Frontend: Vitest + React Testing Library — route/auth guard và logic của hook.
- GitHub Actions chạy cả 2 bộ test (kèm build production) mỗi lần push/PR vào `main`, tự deploy khi pass.
- Dependabot tự tạo PR cập nhật dependency hàng tuần.

## Changelog

Xem [Releases](../../releases) để biết đầy đủ lịch sử thay đổi. Điểm nổi bật gần đây: trợ lý AI (sửa lỗi/chuẩn hóa văn phong, gợi ý tiêu đề/tóm tắt, phân loại & gắn tag tự động, rà soát thông tin nhạy cảm, tra cứu quy định qua RAG, và thêm màn hình hỏi đáp tự do) chuyển từ gọi thẳng Ollama sang dùng chung **AI Gateway**, nhờ đó app tự chuyển sang model đám mây thay vì mất hẳn AI khi máy chạy model cục bộ offline; tính năng tổng hợp tin địa phương tự động, chống trùng, lấy từ RSS báo chí và Google Tin tức; và trước đó, chuyển hẳn frontend từ Create React App sang Vite (bundle ban đầu nhỏ hơn ~66% nhờ code-split theo route), nâng driver SQL Server qua 6 major version, cùng toàn bộ lớp vận hành nói trên (health check, log xoay vòng, backup tự động, cảnh báo Telegram, CI/CD, và bộ test tự động của project).

## License

Project nội bộ — chưa chỉ định license.
