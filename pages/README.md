# HTML page routes

`server/index.js` serves the files in this directory through explicit routes. The four member spaces have clean canonical URLs and share a cross-page dock navigation; they can also be opened directly through their `.html` or `/pages/*.html` aliases. On pages with the Wabi Sabi brand mark, five clicks on the logo open `/sanctuary`, the existing Admin sign-in page. This shortcut only navigates; curator authentication remains server-validated.

| Page | Canonical route | Access | Notes |
| --- | --- | --- | --- |
| `home.html` | `/` | Public | Public portal and links to the four member spaces |
| `sanctuary.html` | `/sanctuary` | Public sign-in form | Curator authentication entry point |
| `my-space.html` | `/my-space` | Public access shell; member APIs gate private data | Member-code entry and private personal desk |
| `community.html` | `/community` | Active member or curator session | Standalone Community space; links to Reader, Table Room, and Wabi Wall |
| `reader.html` | `/reader` | Active member or curator session | Standalone Reader; links to the other spaces |
| `table-room.html` | `/table-room` | Active member or curator session | Standalone Table Room; links to the other spaces |
| `wabi-wall.html` | `/wabi-wall` | Active member or curator session | Standalone Wabi Wall; curator controls remain role-gated |
| `curator.html` | `/curator` | Curator session only | Curator management console |

Unauthenticated visits to member-space routes redirect to `/my-space?returnTo=<space>`. After the member API confirms a session, the member desk returns only to one of the four allowlisted local destinations. HTML responses are not cached. Direct aliases use the same server-side guard; the static `/pages` mount cannot bypass it.

`join.html`, `application-status.html`, and `theme-weeks.html` are retained files for compatibility, but their old routes are no longer part of the active member journey. See [`../server/README.md`](../server/README.md) for the mounted API inventory and current access model.
