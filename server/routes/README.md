# Active API route catalog

This catalog follows the mounts in `server/index.js`. A router file on disk is not an active endpoint unless it is mounted there.

## Mounted routers

| Prefix | Module | Access |
| --- | --- | --- |
| `/api/portal` | `portal.js` | Public; returns announcements, the public member directory, and connection links |
| `/api/auth` | `auth.js` | Curator login, logout, and curator-session verification |
| `/api/curator` | `curator.js` | Curator session required for management operations |
| `/api/member` | `member.js` | Member-code access/status and private member desk, reading, notes, leave, and claim-pass flows |
| `/api/user` | `user.js` | Remembered public-reader profile |

## Page protection is separate from API protection

The standalone HTML pages `/community`, `/reader`, `/table-room`, and `/wabi-wall` (plus their `.html` and `/pages/*.html` aliases) use the server-side `requireMemberPage` guard in `middleware/memberAuth.js`. It accepts a verified active member session or curator session, applies `private, no-store`, and returns unauthenticated visitors to the member-code entry flow with a local allowlisted return path. This page guard does not authorize member or curator API operations; those use their own route middleware.

## Legacy endpoints

- `GET /api/notices` is a compatibility redirect to `/api/portal`; the old notices router is not mounted.
- `/api/community` and `/api/chat` are not mounted in the current server. The corresponding legacy page scripts may still reference those paths, but no poll/chat persistence API is provided by this application version.
- `content.js` and `notices.js` are retained source files but are not mounted by `server/index.js`.

Use the router modules and `server/index.js` as the source of truth when adding an endpoint. New write operations must use server-validated sessions and the existing request-origin protections.
