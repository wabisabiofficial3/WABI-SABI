# Active API route catalog

This catalog follows the mounts in `server/index.js`. A router file on disk is not an active endpoint unless it is mounted there.

## Mounted routers

| Prefix | Module | Access |
| --- | --- | --- |
| `/api/portal` | `portal.js` | Public; announcements, public member directory, gathering links |
| `/api/auth` | `auth.js` | Curator login, logout, and session verification |
| `/api/curator` | `curator.js` | Curator session required for management operations |
| `/api/member` | `member.js` | Member-code access/status and private desk, reading, notes, notification feed/read state, leave, and claim-pass flows |
| `/api/notices` | `notices.js` | Public active Wabi Wall reads; curator session required for every mutation |
| `/api/user` | `user.js` | Remembered public-reader profile |

## Wabi Wall contract

`GET /api/notices` returns active cards in `{ success, theme, notices }`; it does not redirect to the portal. Each public card contains its safe display fields, parsed metadata, layout, pin style, and publication/update timestamps—not internal curator identifiers.

Curator mutations are validated and protected by `requireCurator`:

- `POST /api/notices` creates a card and returns `noticeId` plus `notificationsCreated`.
- `PUT /api/notices/:id` applies a partial content/style update. A no-op returns `notificationsCreated: 0` and creates no duplicate alert.
- `PATCH /api/notices/:id/position` stores layout-only changes; dragging does not create a member broadcast.
- `PATCH /api/notices/:id/pin` toggles prominence and broadcasts the content change.
- `POST /api/notices/:id/archive` and `DELETE /api/notices/:id` remove a card from the member-facing board and broadcast that change.

Change notifications share a transaction with successful persisted mutations. Wabi Wall notifications open `/wabi-wall`; positioning-only changes are intentionally silent. The active client is `js/wabi-wall.js` on the protected `/wabi-wall` page.

## Member notifications and curator preview

`GET /api/member/notifications` returns only the authenticated member's recipient snapshot, unread count, and read state. `POST /api/member/notifications/:id/read` and `POST /api/member/notifications/read-all` change read state for that member only. An authenticated curator may request a target feed with `?preview=<memberId>`, but preview is read-only: `requireMember` rejects every non-`GET`/`HEAD` preview operation before a member route can mutate data.

## Page protection is separate from API protection

The standalone HTML pages `/community`, `/reader`, `/table-room`, and `/wabi-wall` (plus their `.html` and `/pages/*.html` aliases) use the server-side `requireMemberPage` guard in `middleware/memberAuth.js`. It accepts a verified active member session or curator session, applies `private, no-store`, and returns unauthenticated visitors to the member-code entry flow with a local allowlisted return path. This page guard does not authorize member or curator API operations; those use their own route middleware. `/my-space` is an access shell; private data is fetched from member-authenticated endpoints.

## Legacy endpoints

- `/api/community` and `/api/chat` are not mounted in the current server. Some older Community/Table Room interactions still reference those paths; no poll/chat persistence API is provided by this application version.
- Membership application and theme-week page routes are retired and redirect to `/`. Their retained client scripts are not part of the active route flow.
- `content.js` is retained as an unmounted legacy router; the active Wabi Wall API is `notices.js`.

Use the router modules and `server/index.js` as the source of truth when adding an endpoint. New write operations must use server-validated sessions and the existing request-origin protections.
