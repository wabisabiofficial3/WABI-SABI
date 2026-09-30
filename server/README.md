# 🖥️ Wabi Sabi — Server Architecture Manual (`server/`)

This directory contains the entire backend infrastructure for the Wabi Sabi sanctuary: the Express server application, database engine connection, schema migrations, and seed pipelines.

---

## 📂 Directory Layout

```
server/
├── index.js              # Express app entrypoint, static routes & server bootstrap
├── db.js                 # SQLite engine (node:sqlite WAL mode), tables & seeding
├── schema.sql            # Reference PostgreSQL / Supabase schema with RLS policies
├── supabase.js           # Supabase client initializer (optional cloud persistence)
├── middleware/           # Request interceptors & route authentication guards
│   ├── auth.js           # Authentication & RBAC protection (API + Page Guards)
│   └── README.md         # Detailed middleware documentation
└── routes/               # Modular Express API routers
    ├── application.js    # /api/application (Membership application & review status)
    ├── auth.js           # /api/auth (Login, logout, session verification)
    ├── chat.js           # /api/chat (Table Room live discussion stream & likes)
    ├── community.js      # /api/community (Weekly poll votes & reader thoughts)
    ├── content.js        # /api/content (Featured picks & salons CMS with RBAC)
    ├── curator.js        # /api/curator (Application reviews, approvals & stats)
    ├── notices.js        # /api/notices (Wabi Wall corkboard notices & timeline)
    └── README.md         # Detailed API routes documentation
```

---

## 📄 File Inventory & Operational Details

### 1. `index.js` — Core Express Server Application
- **Role:** Main backend server entrypoint.
- **Port:** Default `3000` (configurable via `process.env.PORT`).
- **Key Responsibilities:**
  - Configures global middleware: `express.json()`, `cookieParser()`, request logger, and CORS headers supporting `credentials: include`.
  - **Public Page Routes:** Serves `/`, `/login`, `/login.html`, `/index.html`, `/join`, and `/application-status`.
  - **Server-Side Page Route Guards:** Uses `requirePageAuth` and `requireCuratorPage` from `middleware/auth.js` to guard all protected member pages:
    - `/home` & `/home.html` → requires active authenticated session.
    - `/community` & `/community.html` → requires active authenticated session.
    - `/reader` & `/reader.html` → requires active authenticated session.
    - `/table-room` & `/table-room.html` → requires active authenticated session.
    - `/wabi-wall` & `/wabi-wall.html` → requires active authenticated session.
    - `/curator` & `/curator.html` → requires `role === 'CURATOR'`.
    - *Unauthenticated requests receive an HTTP 302 redirect to `/login?redirect=<target>`.*
    - *Non-curator members attempting to enter `/curator` receive an HTTP 302 redirect to `/home`.*
  - **API Mounting:** Mounts all routers under `/api/*`.
  - **Static Asset Serving:** Serves static files (`css/`, `js/`, `assets/`, `site.webmanifest`, `favicon.ico`) via `express.static()`.
  - **Bootstrap:** Invokes `seedInitialAccounts()` from `db.js` before calling `app.listen()`.
- **Connections:**
  - Imports: `db.js`, `middleware/auth.js`, all routers in `routes/`.
  - Exported Symbol: `{ app, startServer }`.

---

### 2. `db.js` — SQLite Database Engine & Schema Migrations
- **Role:** Centralized database connection, table creation, and seed data manager.
- **Engine:** Built-in `node:sqlite` (`DatabaseSync`), operating with **WAL (Write-Ahead Logging)** mode for concurrent high-performance reads and writes.
- **Database File:** Stored at `../data/wabisabi.db`.
- **Active Database Tables Managed:**
  1. `users`: Member profiles, email, display name, handle, role (`USER` or `CURATOR`), status (`ACTIVE`, `PENDING`, `REJECTED`), Argon2id password hash, and salt.
  2. `sessions`: Secure 64-character hex session tokens (stored as SHA-256 hashes with expiration timestamps).
  3. `applications`: Member application submissions (favorite book, essay response, reading philosophy, curator review notes).
  4. `notices`: Wabi Wall corkboard notices (type, title, subtitle, date, notes, pinned state, coordinates `x, y, rotation`).
  5. `site_content`: Key/value JSON store for global site configuration (featured book of the month, upcoming salon, sticky note prompts).
  6. `table_room_messages`: Table Room live chat messages with week tags (`week_number`) and atomic like counters.
  7. `poll_votes`: Community poll voting records enforcing a `UNIQUE(user_id, poll_id)` constraint so members cannot double-vote.
  8. `community_thoughts`: Community reflection threads with author handles and atomic like counters.
- **Seed Pipeline:**
  - Runs automatically on server startup.
  - Seeds default curators: `curator@wabisabi.club`, `ganganidhanush@gmail.com`, `nrlikith6@gmail.com`, `sarvasreeyuvaraj02@gmail.com`.
  - Seeds default member: `member@wabisabi.club` (`member123`).
  - Seeds initial notice board announcements, default site content, and sample community threads.
- **Connections:**
  - Required by: `server/index.js`, `server/routes/*.js`, `server/middleware/auth.js`.
  - Exported Symbols: `{ db, seedInitialAccounts }`.

---

### 3. `schema.sql` — Reference PostgreSQL & Supabase DDL
- **Role:** Reference PostgreSQL schema with Row-Level Security (RLS) policies.
- **Purpose:** Provides the exact migration blueprint should the team deploy Wabi Sabi to a remote PostgreSQL / Supabase cloud instance.
- **Contents:**
  - UUID primary keys, foreign key cascades, check constraints.
  - RLS policies for `users`, `applications`, `notices`, `site_content`, `table_room_messages`, `poll_votes`, and `community_thoughts`.
  - Role checks for `auth.jwt() -> role = 'CURATOR'`.

---

### 4. `supabase.js` — Cloud Persistence Client (Optional)
- **Role:** Supabase JS SDK client initialized with `.env` credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- **Purpose:** Used when synchronizing data to cloud Supabase instances or listening to Supabase Realtime channels.
