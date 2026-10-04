# Server authentication and access middleware

The middleware in this directory separates curator sessions, member-code sessions, page delivery, and API authorization. Page guards are a usability boundary; API routes must still use their own role/session middleware.

## `auth.js` — curator access

- `getAuthenticatedCurator(req)` verifies the curator session cookie against the hashed, unexpired token in SQLite.
- `requireCurator(req, res, next)` protects curator APIs and returns `401` JSON when there is no valid curator session. `requireAuth` remains an alias for compatibility; it is also curator-only.
- `requireCuratorPage(req, res, next)` protects `/curator` page aliases, sets `Cache-Control: private, no-store`, and redirects visitors to `/sanctuary?redirect=<local-path>`.
- Login throttling helpers track failures by IP and account/IP pair.

## `memberAuth.js` — member access

- `getAuthenticatedMember(req)` verifies the HTTP-only `wabisabi_member_session` cookie against the active SQLite session record.
- `requireMember(req, res, next)` protects member APIs. It returns `401` when no session exists and `403` when the membership is inactive. The existing explicit curator-preview flow is supported only where a route opts into it.
- `optionalMember(req, res, next)` attaches an active member when present without blocking visitors; `/api/member/status` uses this for navigation state.
- `requireMemberPage(req, res, next)` protects `/community`, `/reader`, `/table-room`, and `/wabi-wall`, including `.html` and `/pages/*.html` aliases. It serves no HTML to an unauthenticated visitor, sets `Cache-Control: private, no-store`, and sends the visitor to the member-code page with a local allowlisted return destination. Active curator sessions are also permitted to view these spaces.

## Security boundary

`js/store.js` verifies sessions for client behavior, but localStorage and client guards are never accepted as authentication. Member APIs continue to require member sessions, and curator writes continue to require curator sessions even when a page shell is available. Session cookies are HTTP-only; member and curator tokens are separate and only token hashes are stored in the database.
