<div align="center">
  <img src="docs/logo-banner.jpg" alt="QuanLyTinBai logo" width="200" />

  # QuanLyTinBai
  ### Newsroom Editorial Workflow System

  *Uy tín · Chính xác · Kịp thời*

  [![CI](https://github.com/anhtaictv/QuanLyTinBaiReact/actions/workflows/ci.yml/badge.svg)](https://github.com/anhtaictv/QuanLyTinBaiReact/actions/workflows/ci.yml)
  [![Release](https://img.shields.io/github/v/release/anhtaictv/QuanLyTinBaiReact)](https://github.com/anhtaictv/QuanLyTinBaiReact/releases)
  [![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
  [![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
  [![License](https://img.shields.io/badge/license-Private-lightgrey)](#license)

  🇻🇳 [Tiếng Việt](./README.vi.md)
</div>

---

A full-stack system that runs a newsroom's editorial pipeline end to end: contributors submit articles with an attached Word document, editors and department heads review and approve them, approved files can be round-tripped through Google Docs for collaborative editing, and the team coordinates through a built-in chat. On top of the workflow, an optional **AI assistant** helps proofread, categorize, fact-check, and answer regulation questions over submissions, and an automated **local news digest** keeps the desk aware of relevant regional coverage — all with server-enforced roles, automated backups, and self-monitoring baked in.

- **Backend**: Node.js + Express REST API, Socket.IO, MSSQL (SQL Server)
- **Frontend**: React 18 SPA, built with Vite
- **AI**: Local-first via a shared **AI Gateway** (self-hosted Ollama, with cloud fallback when unreachable) — optional, degrades gracefully when not configured

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Roles](#roles)
- [Getting started](#getting-started)
- [Testing & CI](#testing--ci)
- [Changelog](#changelog)
- [License](#license)

## Features

**Editorial workflow**
- JWT authentication with role-based access control (`CTV`, `Người duyệt`, `Trưởng ban`, `Thư ký`, `Kiểm soát viên`, `Admin`)
- Submit → review/approve/reject → lock/unlock → editor revision → final approval, enforced **server-side** by role, not just hidden in the UI
- `.doc` / `.docx` / `.pdf` upload (Multer, 100MB limit), structured date-based storage
- Optional round-trip through **Google Drive**: convert to a Google Doc for collaborative editing, then export back to `.docx` automatically
- Generate formatted `.docx` storyboards from a template (`docxtemplater` + `pizzip`)
- Server-side search, filtering, and pagination on the article list — doesn't load the entire table into the browser

**AI assistant** (`/api/ai/*` — off by default, never blocks the workflow if unconfigured)
- **Editorial assistant**: proofread and normalize wording to journalistic style, suggest 5 headline options, summarize a lede ("sapo") — results are always shown for preview, the editor chooses to apply or discard
- **Auto-categorization & tagging**: suggests the right existing category and extracts key entities (people, places, organizations) as reference tags, one click to apply
- **Sensitive-data / compliance screening**: before submission, content is scanned two ways — a regex layer that catches ID numbers, phone numbers, and license plates (works even if the AI model is offline) and an LLM pass that flags wording that may violate editorial guidelines; the editor decides whether to fix it or send anyway
- **Regulation lookup (RAG)**: admins/department heads ingest internal editorial guidelines or press-law documents into a local knowledge base; editors can then ask natural-language questions and get answers grounded only in the ingested text, with citations — no hallucinated policy
- **Free-form assistant chat**: a general-purpose AI chat view for ad-hoc questions, always answering in Vietnamese regardless of how the question is phrased
- Every request goes through a shared **AI Gateway** (`aiGatewayClient.js`, OpenAI-compatible `/v1/chat/completions` + `/v1/embeddings` contract) that tries a self-hosted Ollama instance first and falls back to a cloud model when it's unreachable — the app itself never talks to Ollama or a cloud provider directly; every AI route returns a clean `503` when the gateway is unreachable instead of failing the request

**Local news digest** (`/api/news-digest/*`)
- Periodically pulls RSS feeds from major national outlets plus a Google News search feed, filters for items relevant to the newsroom's coverage area, and stores them for the team to browse
- Two-layer dedup: exact-link collision at the database level, plus title-normalization matching so the same story picked up from two different feeds (or a reprint) doesn't show twice
- Runs on a schedule (external task scheduler / cron, since SQL Server Express has no built-in Agent) or on demand via a "Refresh now" action for Admin/Department Head/Secretary

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
- CI on every push/PR (build + test, both apps); automatic deployment on push to `main` via a self-hosted runner; Dependabot keeps dependencies current

## Tech stack

| Layer | Stack |
|---|---|
| API | Express 4, `mssql` (Tedious), `jsonwebtoken`, `bcrypt`, `multer`, `helmet`, `express-rate-limit`, `express-validator` |
| Real-time | Socket.IO (JWT-authenticated handshake) |
| AI | Shared **AI Gateway** (OpenAI-compatible) fronting a self-hosted [Ollama](https://ollama.com) instance with cloud fallback, JSON-file vector store with cosine-similarity search for RAG |
| News digest | `rss-parser` (feeds + Google News search RSS) |
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
    controllers/               # auth, news, chat, ai, rag, newsDigest
    middleware/                # authMiddleware, validators
    routes/                     # news, file, drive, push, chat, errorLog, ai, newsDigest
    services/                   # aiGatewayClient.js, ragStore.js (JSON vector store)
    sockets/                    # chat socket handlers
    utils/errorLogger.js        # writes to dbo.ErrorLogs + optional Telegram alert
    scripts/                    # daily-backup.js, fetch-news-digest.js, and other maintenance scripts
    tests/                      # node:test suites
    server.js
frontend/                    # React SPA
  src/
    components/                 # ErrorBell, ChatBell, AIBell, ai/ (editorial panel, category suggest, sensitive-data warning), icons, ...
    hooks/                      # useIdleLogout, usePushNotification, useChatSocket, ...
    layout/MainLayout.jsx
    services/                   # api.js, newsService.js, chatService.js, aiService.js, ...
    views/                      # Login, Dashboard, NewsList, NewsForm, Chat, NewsDigest, AiAssistant, AIKnowledge, ...
  vite.config.js
```

## Roles

| Role | RoleID | Typical permissions |
|---|---|---|
| CTV (Contributor) | 1 | Submit articles, view own submissions |
| Người duyệt (Reviewer) | 2 | Approve/reject, editor revision |
| Trưởng ban (Department Head) | 3 | Approve/reject, lock/unlock |
| Admin | 4 | Full access, user management, error log |
| Thư ký (Secretary) | 5 | Handles already-approved posts only (archiving/publishing) — cannot see or approve pending posts |
| Kiểm soát viên (Controller) | 6 | View all posts (any status), no approve/lock/edit |

Role checks are enforced **server-side** (middleware), not just hidden in the UI. Managing the RAG knowledge base (ingesting/deleting regulation documents) is additionally restricted to Admin / Trưởng ban / Thư ký.

## Getting started

### Prerequisites
- Node.js 18+
- SQL Server reachable from the backend host
- (Optional) Google Cloud OAuth2 credentials for Drive integration
- (Optional) VAPID keys for Web Push (`npx web-push generate-vapid-keys`)
- (Optional) A Telegram bot token for error alerts (create one via [@BotFather](https://t.me/BotFather))
- (Optional) A reachable **AI Gateway** endpoint (`AI_GATEWAY_URL` + `AI_GATEWAY_API_KEY`, OpenAI-compatible `/v1/chat/completions` + `/v1/embeddings`) for the AI assistant features; without it those routes just respond `503`

### Backend

```bash
cd backend/backend
npm install
cp .env.example .env   # fill in your own values
npm run dev            # nodemon, or: npm start
npm test                # run the test suite (node:test)
```

Environment variables (`backend/backend/.env`) — see [`.env.example`](./backend/.env.example) for the full, current list. Only `DB_*` and `JWT_SECRET` are required; everything else (Google Drive, Web Push, Telegram, backup settings, `AI_GATEWAY_*`) is optional and degrades gracefully when unset — the AI routes simply respond `503` with `connected: false` instead of breaking the rest of the app.

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

The app expects a SQL Server database with `dbo.Users`, `dbo.Posts`, `dbo.PushSubscriptions`, `dbo.ErrorLogs`, `dbo.NewsDigestItems` (see `scripts/create-news-digest-table.js`), and the chat tables (see `scripts/create-chat-tables.js`). `scripts/daily-backup.js` performs a full `BACKUP DATABASE` and prunes backups older than `DB_BACKUP_RETENTION_DAYS` (default 14) — intended to run on a schedule (e.g. Windows Task Scheduler or cron), since SQL Server Express has no built-in Agent. `scripts/fetch-news-digest.js` runs the RSS digest fetch the same way.

### Deployment

Any setup that can run a long-lived Node process and serve a static SPA works — for example: PM2 (or another process manager) for the API, and a static file server / reverse proxy in front of the React build, proxying `/api/*` and `/socket.io/*` to the Node process. `GET /api/health` is available for uptime monitoring. This repo's own CI/CD (`.github/workflows/deploy-windows.yml`) deploys automatically on every push to `main` that passes CI, via a self-hosted GitHub Actions runner.

## Testing & CI

- Backend: `node --test` — auth middleware, input-validation rules, AI Gateway client behavior, AI conversation handling, and news-digest text utilities (keyword matching, dedup, summary trimming).
- Frontend: Vitest + React Testing Library — routing/auth guards and hook logic.
- GitHub Actions runs both suites (plus a production build) on every push and pull request to `main`, and auto-deploys on success.
- Dependabot opens PRs for dependency updates on a weekly schedule.

## Changelog

See [Releases](../../releases) for the full history of changes. Recent highlights: the AI assistant (editorial proofreading, auto-categorization, sensitive-data screening, regulation Q&A via RAG, and a new free-form assistant chat) migrated from calling Ollama directly to a shared **AI Gateway**, so the app now degrades to a cloud fallback instead of losing AI entirely when the local model host is offline; an automated local news digest pulling and deduplicating regional coverage from RSS and Google News; and, earlier, a full move off Create React App onto Vite (~66% smaller initial bundle via route-level code-splitting), an SQL Server driver upgrade across six majors, and the operational layer described above (health check, log rotation, automated backups, Telegram alerts, CI/CD, and the project's automated test suite).

## License

Private/internal project — no license specified.
