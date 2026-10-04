# Wabi Sabi

A quiet digital home for the Wabi Sabi bookclub: public announcements, a curated member directory, external gathering links, a private member reading desk, four standalone member spaces, and a curator console.

## Current application

The active server is an Express application backed by SQLite (`server/index.js`, `server/db.js`). The public home page is served at `/` and `/home.html`. The curator console is served at `/curator` only after a valid curator session; `/sanctuary` is the curator sign-in page. `/my-space` serves the member desk, which requires a member code to load private data. `/community`, `/reader`, `/table-room`, and `/wabi-wall` are independent, cross-linked member-space pages; each route (including its `.html` and `/pages/*.html` aliases) is protected by a server-verified active member or curator session.

| Area | Active endpoints |
| --- | --- |
| Public portal | `GET /api/portal` |
| Curator authentication | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/session` |
| Curator console | `/api/curator/overview`, `/api/curator/announcements`, `/api/curator/updates`, `/api/curator/members`, `/api/curator/connect`, `/api/curator/profile`, `/api/curator/settings`, `/api/curator/features`, `/api/curator/sticky-notes` |
| Member desk | `/api/member/access`, `/api/member/status`, `/api/member/me`, `/api/member/reading`, `/api/member/notes`, `/api/member/leave`, `/api/member/claim-pass` |
| Remembered public-reader profile | `/api/user/profile` |
| Protected member spaces | `/community`, `/reader`, `/table-room`, `/wabi-wall` (also `.html` and `/pages/*.html` aliases) |
| Health | `/health`, `/api/health` |

Unauthenticated requests to a member-space route redirect to `/my-space?returnTo=<space>`; after successful member-code verification, the member is returned only to an allowlisted Wabi Sabi space. Five clicks on the Wabi Sabi brand mark open `/sanctuary`, the existing Admin sign-in page; the shortcut does not bypass server authentication. Curator-only pages and write APIs remain server-guarded, and browser storage is never accepted as authentication. These route changes restore the standalone pages and their shared navigation; the older `/api/community` and `/api/chat` backends are not mounted in the current server. The optional Supabase files are not used by the active SQLite application.

## Requirements and setup

- Node.js **22.13.0 or newer** (`node:sqlite` is used by the server).
- npm.

```bash
npm install
npm start
```

The server listens on `PORT` (default `3000`). Copy `.env.example` to `.env` if you need deployment-specific settings. `.env` and the SQLite database directory are ignored by Git.

### Curator account bootstrap

There is **no shared default curator password** in the application. On the first production boot, set `WABI_ADMIN_PASSWORD` to a unique password of at least 12 characters. `WABI_ADMIN_EMAIL` and `WABI_ADMIN_HANDLE` may be set at the same time. These values initialize the account; subsequent profile/password changes made in the curator console are persisted in SQLite.

In local development only, if no bootstrap password is configured, the server generates a random one-time password and writes it to `data/initial-admin-password.txt` with owner-only file permissions. Sign in with the configured/default admin email and that password, then change it in the curator profile. The one-time file is removed after a successful password change. Production startup fails closed if a new or known-compromised bootstrap account needs to be initialized without `WABI_ADMIN_PASSWORD`.

Set `APP_BASE_URL` to the HTTPS public origin in production so QR membership passes use the correct host. The server trusts one reverse-proxy hop by default; set `TRUST_PROXY_HOPS=0` when running directly without a proxy, or set it to the exact trusted hop count for your deployment. `CORS_ALLOWED_ORIGINS` accepts only exact, comma-separated origins; same-origin requests work without configuration.

## Storage and security notes

- SQLite data lives at `data/wabisabi.db` by default. Override it with `WABI_DB_PATH` when testing or using a different persistent volume. On POSIX systems, the database and active WAL sidecars are restricted to owner-only permissions.
- Curator passwords are Argon2id hashes. Session tokens are cryptographically random and only their hashes are stored in SQLite.
- Member codes are generated randomly and stored as hashes. Curator-issued QR passes are single-use; opening a QR URL displays a confirmation first, so link-preview scanners cannot consume a pass.
- Sensitive API responses are not cached. Writes are same-origin by default, and curator/member APIs require server-validated sessions. API requests are rate-limited before parsing, JSON bodies are capped at 100 KB, and parser errors never return stack traces. Rate-limit counters are in-memory per Node process; use a shared limiter or trusted edge limit if scaling to multiple instances.
- The CSP blocks plugins and narrows script origins, but retains `unsafe-inline` for the existing static pages' inline code. A nonce/hash policy is a future hardening step; active API-rendered text is escaped or assigned as text.
- Remembered reader profiles are served through the profile API and stored in an HTTP-only, same-site cookie.
- Never add `.env`, generated bootstrap passwords, database files, or real member access codes to Git.

## Tests

```bash
npm test
```

The test runner uses an isolated temporary SQLite database and an explicitly test-only curator password. It runs API/security regression checks and static integrity checks without requiring Microsoft Edge. Browser screenshot/capture scripts in `tests/` are optional and require a browser configured through the respective test script.

`server/schema.sql` is an optional, non-destructive Supabase/PostgreSQL schema. It no longer drops tables or seeds public default credentials; it is not used by `npm start`.
