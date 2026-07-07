# QuanLyTinBai — News/Article Management System

A full-stack editorial workflow system for newsrooms: contributors submit articles with an attached Word document, editors and department heads review/approve them, and approved files can be round-tripped through Google Docs for collaborative editing before being archived back to storage.

- **Backend**: Node.js + Express REST API, MSSQL (SQL Server)
- **Frontend**: React 18 SPA (Vite)

> 🇻🇳 Vietnamese version: [README.vi.md](./README.vi.md)

## Features

- **JWT authentication** with role-based access control (`CTV`, `Người duyệt`, `Trưởng ban`, `Thư ký`, `Kiểm soát viên`, `Admin`)
- **Editorial workflow**: submit → review/approve/reject → lock/unlock → editor revision → final approval, all enforced server-side by role
- **File handling**: `.doc` / `.docx` / `.pdf` upload (Multer), structured date-based storage, optional round-trip through **Google Drive** (convert to Google Doc for collaborative editing, then export back to `.docx`)
- **Word export**: generate a formatted `.docx` storyboard from a template (`docxtemplater` + `pizzip`)
- **Web Push notifications** (VAPID) for approval/rejection/new-submission events
- **Dashboard** with post/user statistics (`recharts`)
- **User management**: list, change role, delete (Admin only)
- **Admin error monitoring**: every server-side error (HTTP 500) is automatically logged to the database and surfaced to Admins through a 🚨 bell icon in the top bar (unread count, detail panel, mark-as-read)

## Tech stack

| Layer | Stack |
|---|---|
| API | Express 4, `mssql` (Tedious), `jsonwebtoken`, `bcrypt`, `multer`, `express-rate-limit` |
| Integrations | Google APIs (Drive, OAuth2), `web-push` |
| Documents | `docxtemplater`, `pizzip`, `mammoth`, `html-docx-js` |
| Frontend | React 18, React Router 6, Axios, `react-toastify`, `recharts`, Service Worker (push) |
| Database | Microsoft SQL Server |

## Project structure

```
backend/
  backend/
    config/db.js            # MSSQL connection pool
    controllers/             # authController, newsController
    middleware/authMiddleware.js
    routes/                  # news, file, drive, push, errorLog routes
    utils/errorLogger.js     # writes errors to dbo.ErrorLogs
    scripts/                 # one-off maintenance/migration scripts
    server.js
  frontend/
    src/
      components/ErrorBell.jsx
      hooks/                 # useIdleLogout, usePushNotification
      layout/MainLayout.jsx
      services/              # api.js, newsService.js, errorLogService.js
      views/                 # Login, Dashboard, NewsList, NewsForm, ...
```

## Roles

| Role | RoleID | Typical permissions |
|---|---|---|
| CTV (Contributor) | 1 | Submit articles, view own submissions |
| Người duyệt (Reviewer) | 2 | Approve/reject, editor revision |
| Trưởng ban (Department Head) | 3 | Approve/reject, lock/unlock |
| Admin | 4 | Full access, user management, error log |
| Thư ký (Secretary) | 5 | Approve/reject |
| Kiểm soát viên (Controller) | 6 | View |

Role checks are enforced **server-side** (middleware), not just hidden in the UI.

## Getting started

### Prerequisites
- Node.js 18+
- SQL Server reachable from the backend host
- (Optional) Google Cloud OAuth2 credentials for Drive integration
- (Optional) VAPID keys for Web Push (`npx web-push generate-vapid-keys`)

### Backend

```bash
cd backend/backend
npm install
cp .env.example .env   # fill in your own values
npm run dev            # nodemon, or: npm start
```

Required environment variables (`backend/backend/.env`):

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

Never commit `.env`, `service-account.json`, `oauth-credentials.json`, or `google-token.json` — they are already gitignored.

### Frontend

```bash
cd backend/frontend
npm install
npm run dev      # dev server (Vite, port 3000, proxies /api and /socket.io to :5001)
npm run build    # production build into build/
npm run preview  # preview the production build
```

Set `VITE_API_URL` (e.g. in `.env.production`) to point the SPA at your deployed API. Default (unset) is `/api`, same-origin — matches setups with a reverse proxy (IIS URL Rewrite) in front.

### Database

The app expects a SQL Server database with `dbo.Users`, `dbo.Posts`, `dbo.PushSubscriptions`, and `dbo.ErrorLogs` tables. `backend/backend/scripts/backup-and-migrate.js` is a reference script that backs up the database and creates the `ErrorLogs` table if missing.

### Deployment

Any setup that can run a long-lived Node process and serve a static SPA works — for example: PM2 (or another process manager) for the API, and any static file server / reverse proxy in front of the React build, with `/api/*` proxied to the Node process.

## Recent improvements (changelog)

A security/maintenance pass was done covering:

**Security & bug fixes**
- Added server-side `requireRoles()` middleware — approve/reject, lock/unlock, and editor-approve actions were previously only hidden in the UI but callable by *any* authenticated user; they are now enforced by role on the API itself.
- `AuthorID` on new posts is now taken from the verified JWT instead of a client-supplied field (prevented author spoofing).
- Fixed a broken file path in the Word export endpoint (`exportNewsWord`) that always looked in a non-existent folder.
- `STORAGE_ROOT` is now actually read from `.env` in the file/Drive routes (was hard-coded, ignoring configuration).
- Parameterized a previously string-concatenated SQL `IN (...)` clause.
- Removed a duplicate, overly-permissive CORS header middleware and a dead/insecure TLS config flag.
- Added rate limiting on `/api/login` and `/api/register` to slow down brute-force attempts.

**Dependency maintenance**
- Updated `express` and `dotenv` to current versions within the same major (no breaking changes).
- Removed an unused/typo'd dependency (`rechart`).

**New: admin error monitoring**
- Every server-side error is now logged to `dbo.ErrorLogs` with source, message, stack trace, user, method, and path.
- A new `/api/errors` API (Admin-only) exposes unread count, listing, and mark-as-read.
- A new `ErrorBell` component shows a live unread-error badge in the UI, polling every 30s, with a detail panel and toast alerts for new errors.

## License

Private/internal project — no license specified.
