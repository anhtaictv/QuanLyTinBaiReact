# QuanLyTinBai — Newsroom Editorial Workflow System

A full-stack system that runs a newsroom's editorial pipeline end to end: contributors submit articles with an attached Word document, editors and department heads review and approve them, approved files can be round-tripped through Google Docs for collaborative editing, and the team coordinates through a built-in chat — all with server-enforced roles, automated backups, and self-monitoring baked in.

- **Backend**: Node.js + Express REST API, Socket.IO, MSSQL (SQL Server)
- **Frontend**: React 18 SPA, built with Vite

> 🇻🇳 Vietnamese version: [README.vi.md](./README.vi.md)

## Features

**Editorial workflow**
- JWT authentication with role-based access control (`CTV`, `Người duyệt`, `Trưởng ban`, `Thư ký`, `Kiểm soát viên`, `Admin`)
- Submit → review/approve/reject → lock/unlock → editor revision → final approval, enforced **server-side** by role, not just hidden in the UI
- `.doc` / `.docx` / `.pdf` upload (Multer, 100MB limit), structured date-based storage
- Optional round-trip through **Google Drive**: convert to a Google Doc for collaborative editing, then export back to `.docx` automatically
- Generate formatted `.docx` storyboards from a template (`docxtemplater` + `pizzip`)
- Server-side search, filtering, and pagination on the article list — doesn't load the entire table into the browser

**Team collaboration**
- Built-in internal chat (1:1 and group), file attachments, message recall/delete — real-time over Socket.IO with JWT-authenticated handshakes
- Web Push notifications (VAPID) for new submissions, approvals, and rejections
- Dashboard with post/user statistics (Recharts)

**Admin tooling**
- User management: list, change role, delete
- Live error monitoring: every server-side error is logged to the database and surfaced through a 🚨 bell icon (unread count, detail panel, mark-as-read)
- Optional Telegram alerts the moment an error happens — no need to have the app open
- Periodic health check on the Google Drive integration, so an expired/revoked token is caught before it blocks an editor mid-review

**Operations**
- `GET /api/health` for external uptime monitors
- Daily automated database backup with retention cleanup
- Rotating logs (size + daily, compressed) so disk usage stays bounded
- CI on every push/PR (build + test, both apps); Dependabot keeps dependencies current

## Tech stack

| Layer | Stack |
|---|---|
| API | Express 4, `mssql` (Tedious), `jsonwebtoken`, `bcrypt`, `multer`, `helmet`, `express-rate-limit`, `express-validator` |
| Real-time | Socket.IO (JWT-authenticated handshake) |
| Integrations | Google APIs (Drive, OAuth2), `web-push`, Telegram Bot API |
| Documents | `docxtemplater`, `pizzip` |
| Frontend | React 18, React Router 6, Axios, Vite, `react-toastify`, `recharts`, Service Worker (push) |
| Testing | `node:test` (backend), Vitest + React Testing Library (frontend) |
| Database | Microsoft SQL Server |

## Project structure

```
backend/
  backend/                    # actual Node/Express app (nested twice — historical repo layout)
    config/db.js              # MSSQL connection pool, retry-with-backoff
    controllers/               # auth, news, chat
    middleware/                # authMiddleware, validators
    routes/                    # news, file, drive, push, chat, errorLog
    sockets/                   # chat socket handlers
    utils/errorLogger.js       # writes to dbo.ErrorLogs + optional Telegram alert
    scripts/                   # daily-backup.js and other maintenance scripts
    tests/                     # node:test suites
    server.js
frontend/                    # React SPA
  src/
    components/                 # ErrorBell, ChatBell, icons, ...
    hooks/                      # useIdleLogout, usePushNotification, useChatSocket, ...
    layout/MainLayout.jsx
    services/                   # api.js, newsService.js, chatService.js, ...
    views/                      # Login, Dashboard, NewsList, NewsForm, Chat, ...
  vite.config.js
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
- (Optional) A Telegram bot token for error alerts (create one via [@BotFather](https://t.me/BotFather))

### Backend

```bash
cd backend/backend
npm install
cp .env.example .env   # fill in your own values
npm run dev            # nodemon, or: npm start
npm test                # run the test suite (node:test)
```

Environment variables (`backend/backend/.env`) — see [`.env.example`](./backend/.env.example) for the full, current list. Only `DB_*` and `JWT_SECRET` are required; everything else (Google Drive, Web Push, Telegram, backup settings) is optional and degrades gracefully when unset.

Never commit `.env`, `service-account.json`, `oauth-credentials.json`, or `google-token.json` — they are already gitignored.

### Frontend

```bash
cd backend/frontend
npm install
npm run dev      # dev server (Vite, port 3000, proxies /api and /socket.io to :5001)
npm run build    # production build into build/
npm run preview  # preview the production build
npm test           # run the test suite (Vitest)
```

Set `VITE_API_URL` (e.g. in `.env.production`) to point the SPA at your deployed API. Default (unset) is `/api`, same-origin — matches setups with a reverse proxy (e.g. IIS URL Rewrite) in front.

### Database

The app expects a SQL Server database with `dbo.Users`, `dbo.Posts`, `dbo.PushSubscriptions`, `dbo.ErrorLogs`, and the chat tables (see `scripts/create-chat-tables.js`). `scripts/daily-backup.js` performs a full `BACKUP DATABASE` and prunes backups older than `DB_BACKUP_RETENTION_DAYS` (default 14) — intended to run on a schedule (e.g. Windows Task Scheduler or cron), since SQL Server Express has no built-in Agent.

### Deployment

Any setup that can run a long-lived Node process and serve a static SPA works — for example: PM2 (or another process manager) for the API, and a static file server / reverse proxy in front of the React build, proxying `/api/*` and `/socket.io/*` to the Node process. `GET /api/health` is available for uptime monitoring.

## Testing & CI

- Backend: `node --test` — auth middleware and input-validation rules.
- Frontend: Vitest + React Testing Library — routing/auth guards and hook logic.
- GitHub Actions runs both suites (plus a production build) on every push and pull request to `main`.
- Dependabot opens PRs for dependency updates on a weekly schedule.

## Changelog

See [Releases](../../releases) for the full history of changes. Highlights of the most recent pass: migrated the frontend build off Create React App onto Vite (~66% smaller initial bundle via route-level code-splitting), upgraded the SQL Server driver across six majors, closed out all known dependency vulnerabilities, and added the operational layer described above (health check, log rotation, automated backups, Telegram alerts, CI, and the project's first automated tests).

## License

Private/internal project — no license specified.
