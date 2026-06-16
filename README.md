# QueryCraft — SQL Report Builder

> Connect to any SQL database and build reports visually — no SQL knowledge required.

QueryCraft is a full-stack web application that lets non-technical users (accounting, sales, management) connect to MySQL, PostgreSQL, or SQL Server databases and create, run, and export reports through a clean step-by-step wizard — without writing a single line of SQL.

---

## Features

- **Visual Report Builder** — 5-step wizard: pick a table, select columns, add filters, set sorting, preview & save
- **Multi-database support** — MySQL, PostgreSQL, SQL Server
- **Secure credential storage** — AES-256 encrypted connection passwords
- **Export** — CSV and Excel (.xlsx) download
- **Saved reports** — create once, run anytime
- **Connection pool caching** — fast repeated queries, no reconnect overhead
- **JWT authentication** — httpOnly cookie sessions with auto-refresh

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Query builder | knex.js (SQL injection safe, parameterized queries) |
| App database | SQLite via Node.js built-in `node:sqlite` |
| Auth | JWT (access 15 min + refresh 7 days) |
| DB drivers | mysql2, pg, tedious (SQL Server) |

---

## Project Structure

```
querycraft/
├── backend/
│   ├── src/
│   │   ├── config/          # Constants, database path
│   │   ├── db/              # SQLite init & schema
│   │   ├── middleware/       # Auth, validation, rate limiting, error handler
│   │   ├── routes/          # auth, connections, database, reports
│   │   ├── services/        # authService, connectionManager, queryBuilder,
│   │   │                    # reportService, exportService, encryption
│   │   ├── utils/           # logger, helpers, validators
│   │   └── server.js
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/      # Layout, ErrorBoundary, UI primitives
    │   ├── context/         # AuthContext
    │   ├── lib/             # utils, in-memory cache
    │   ├── pages/           # Login, Signup, Dashboard, Connections,
    │   │                    # Reports, ReportBuilder, ReportDetail
    │   └── services/        # api, auth, connections, reports
    └── package.json
```

---

## Getting Started

### Prerequisites

- Node.js v22 or higher
- npm v9+

### 1. Clone

```bash
git clone https://github.com/your-username/querycraft.git
cd querycraft
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set the required values:

```env
JWT_SECRET=<random-long-string>
JWT_REFRESH_SECRET=<another-random-long-string>
ENCRYPTION_KEY=<exactly-32-characters-here!!>   # must be exactly 32 chars
```

Install and start:

```bash
npm install
npm run dev        # development (nodemon)
npm start          # production
```

Backend runs on `http://localhost:3001`.

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.  
API calls are proxied to the backend automatically.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Backend port (default: 3001) |
| `JWT_SECRET` | Yes | Access token signing key |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing key |
| `JWT_EXPIRES_IN` | No | Access token TTL (default: 15m) |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token TTL (default: 7d) |
| `ENCRYPTION_KEY` | Yes | AES-256 key — **must be exactly 32 characters** |
| `DB_PATH` | No | SQLite file path (default: ./data/app.db) |
| `FRONTEND_URL` | No | CORS origin (default: http://localhost:5173) |

---

## API Overview

```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/connections
POST   /api/connections
POST   /api/connections/test          # test before saving
POST   /api/connections/:id/test      # test saved connection
PUT    /api/connections/:id
DELETE /api/connections/:id

GET    /api/connections/:id/tables
GET    /api/connections/:id/tables/:name
GET    /api/connections/:id/tables/:name/data?page=1&limit=100

GET    /api/reports
POST   /api/reports
POST   /api/reports/preview
GET    /api/reports/:id
PUT    /api/reports/:id
DELETE /api/reports/:id
POST   /api/reports/:id/execute
GET    /api/reports/:id/export?format=csv|xlsx
```

---

## Security

- Passwords hashed with bcrypt (12 rounds)
- DB credentials encrypted with AES-256-CBC before storage
- All queries use parameterized statements via knex.js — no SQL injection
- JWT tokens stored in httpOnly cookies (not localStorage)
- Rate limiting on auth endpoints (20 req / 15 min)
- Helmet.js security headers
- Result rows capped at 10,000 per query

---

## Roadmap

- [ ] Multi-table JOINs via visual builder
- [ ] Aggregations (GROUP BY, COUNT, SUM, AVG)
- [ ] Scheduled reports (email delivery)
- [ ] Charts & data visualizations
- [ ] Role-based access (admin / viewer)
- [ ] Shared / team reports

---

## License

MIT
