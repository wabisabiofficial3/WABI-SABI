# Wabi Sabi server

The active application is an Express server backed by SQLite. `server/index.js` configures the HTTP security middleware, API routers, page routes, static assets, and server startup. `server/db.js` owns the SQLite schema, migrations, seed data, and database helpers.

## Page routes and access

| Destination | Access |
| --- | --- |
| `/`, `/home`, `/home.html`, `/pages/home.html` | Public portal |
| `/sanctuary` | Curator sign-in page |
| `/my-space` | Member-code entry shell; private member data is loaded only through member-authenticated APIs |
| `/community`, `/reader`, `/table-room`, `/wabi-wall` | Standalone member spaces; each also has `.html` and `/pages/*.html` aliases |
| `/curator` | Active curator session required |

The four member spaces cross-link through their shared navigation. `requireMemberPage` checks the active member-code session or curator session on the server before sending any of those HTML pages. It sets `Cache-Control: private, no-store`. Visitors are sent to `/my-space?returnTo=<allowlisted-space>`; after the member API confirms the session, the page returns only to one of the four local member-space routes. Browser storage and client-side route guards are not authentication controls.

Member APIs continue to use `requireMember`; curator management APIs continue to use `requireCurator`. A valid page session does not grant permission to call a different role's APIs. Curator-only page access and API role checks remain server-side.

## Active API routers

`server/index.js` currently mounts these routers:

- `/api/portal` — public announcements, curated directory, and gathering links.
- `/api/auth` — curator login, logout, and session verification.
- `/api/curator` — curator-only content, member, profile, settings, and feature management.
- `/api/member` — member-code access/status, private desk data, reading progress, notes, and leave/claim flows.
- `/api/user` — optional public-reader profile.

`GET /api/notices` remains a compatibility redirect to `/api/portal`. The legacy `/api/community` and `/api/chat` services are not mounted in the current SQLite application; page-route restoration does not create poll/chat persistence APIs.

## Security and storage

- Global middleware adds security headers, blocks sensitive paths, applies same-origin/CSRF checks, and rate-limits API traffic.
- Curator and member sessions use separate HTTP-only cookies. Only token hashes are stored in SQLite; member codes are stored as hashes.
- Private member data endpoints require a valid active member session (or the explicit curator-preview flow where supported). Curator writes require a valid curator session.
- SQLite uses foreign keys, WAL mode, and a bounded busy timeout. The database path defaults to `data/wabisabi.db` and can be overridden with `WABI_DB_PATH`.
- The optional Supabase files and `schema.sql` are not used by `npm start`.

## Key files

```text
server/
├── index.js                 # Express app, canonical page aliases, static delivery, API mounts
├── db.js                    # SQLite schema, migrations, seeders, data/session helpers
├── crypto.js                # Password and session-token cryptography
├── middleware/
│   ├── auth.js              # Curator authentication, page guard, login throttling
│   ├── memberAuth.js        # Member API/page guards and curator-preview support
│   └── security.js          # Security headers, path protection, origin checks, rate limits
└── routes/
    ├── auth.js              # Curator sign-in/session API
    ├── curator.js           # Curator management API
    ├── member.js            # Member access and private desk API
    ├── portal.js            # Public portal API
    └── user.js              # Remembered public-reader profile API
```

Run the isolated regression suite from the repository root with `npm test`.
