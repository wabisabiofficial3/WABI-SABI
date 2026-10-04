# Client JavaScript

The site uses native browser JavaScript. Session checks in `js/store.js` are for client behavior only; the server validates cookies and authorizes every protected page/API request.

## Active session and portal scripts

| Script | Responsibility | Server endpoints |
| --- | --- | --- |
| `store.js` | Same-origin API wrapper; verifies curator sessions and member-code sessions; exposes client route guard | `/api/auth/session`, `/api/auth/login`, `/api/auth/logout`, `/api/member/status` |
| `portal.js` | Public home theme controls and portal data hydration | `/api/portal`, `/api/user/profile` |
| `curator.js` | Curator console data and management actions | `/api/curator/*` |
| `cat-engine.js` | Decorative Mochi cat and ambient interaction | None |

## Standalone member-space scripts

`community.js`, `reader.js`, `table-room.js`, and `wabi-wall.js` are loaded by their own HTML pages. Their shared navigation uses the canonical routes `/community`, `/reader`, `/table-room`, and `/wabi-wall`. The store verifies `/api/auth/session` or `/api/member/status` before client initialization; this supplements, but never replaces, the server-side `requireMemberPage` guard.

Some interactions in these older page controllers still call legacy routes (`/api/community/*`, `/api/chat/*`, or old `/api/notices` write operations) that are not mounted by the current server. `GET /api/notices` is a compatibility redirect to `/api/portal`. Do not treat these calls as persisted or authorized until a corresponding server router and tests are added. See [`../server/routes/README.md`](../server/routes/README.md) for the active endpoint inventory.

## Other files

`auth.js`, `onboarding.js`, `application.js`, and `theme-weeks.js` remain as legacy page scripts for retired flows. They are not part of the active public portal or member-code session flow. `vendor/` contains local third-party browser libraries.
