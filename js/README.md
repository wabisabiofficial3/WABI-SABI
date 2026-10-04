# Client JavaScript

The site uses native browser JavaScript. Session checks in `js/store.js` are for client behavior only; the server validates cookies and authorizes every protected page/API request.

## Active session and portal scripts

| Script | Responsibility | Server endpoints |
| --- | --- | --- |
| `store.js` | Same-origin API wrapper; verifies curator sessions and member-code sessions; exposes client route guard | `/api/auth/session`, `/api/auth/login`, `/api/auth/logout`, `/api/member/status` |
| `portal.js` | Public home theme controls and portal data hydration | `/api/portal`, `/api/user/profile` |
| `admin-shortcut.js` | Carries a five-click logo shortcut to the existing admin sign-in page; no authentication or authorization decisions | `/sanctuary` navigation only |
| `curator.js` | Curator console data, content and member-management actions; reports when a save produced a member broadcast | `/api/curator/*` |
| `member-notifications.js` | Shared notification center, unread/read state, and validated same-site destinations | `/api/member/notifications*` |
| `cat-engine.js` | Decorative Mochi cat and ambient interaction | None |

## Standalone member spaces

`community.js`, `reader.js`, `table-room.js`, and `wabi-wall.js` are loaded by their own HTML pages. Their shared navigation uses the canonical routes `/community`, `/reader`, `/table-room`, and `/wabi-wall`. The store verifies `/api/auth/session` or `/api/member/status` before client initialization; this supplements, but never replaces, the server-side `requireMemberPage` guard.

`wabi-wall.js` uses the active `/api/notices` router: it loads active cards, saves curator content, archives cards, and persists drag positions. Curator changes receive a member-facing success message only when the server confirms a notification was created; position-only saves are silent. See [`../server/routes/README.md`](../server/routes/README.md) for the endpoint contract.

Some older Community and Table Room interactions still call `/api/community/*` or `/api/chat/*`, which are not mounted by the current server. Those legacy calls do not persist data in this version. The Wabi Wall API is active and should not be confused with the retired theme-week route.

## Legacy scripts

`onboarding.js`, `application.js`, and `theme-weeks.js` remain as scripts from retired flows. The corresponding membership-application and theme-week page routes redirect to the public portal; these scripts are not part of the active member-code flow. `vendor/` contains local third-party browser libraries.
