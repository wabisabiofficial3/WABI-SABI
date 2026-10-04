# Wabi Sabi test suite

The active regression suite runs sequentially against an isolated temporary SQLite database. From the repository root, run:

```bash
npm test
```

`tests/run_all_tests.js` currently executes 13 suites:

| Test | Coverage |
| --- | --- |
| `check_links.js`, `check_assets.js` | Internal routes, asset references, and local files |
| `test_design_tokens_and_a11y.js`, `test_hero_ctas.js` | Responsive/design tokens, accessible zoom, and portal controls |
| `test_js_syntax.js` | First-party JavaScript syntax |
| `test_simplified_architecture.js` | Public portal, curator RBAC, and the four independent member-space routes |
| `test_page_guards.js` | Member/curator sessions, protected aliases, no-store headers, and suspended-member denial |
| `test_client_guards.js` | Server-verified client session checks and cross-space navigation links |
| `e2e_sanctuary_test.js` | Curator sign-in, editing, public hydration, and logout |
| `test_interactive_and_admin_purge.js` | Public directory integrity and curator-account restrictions |
| `test_member_access_system.js` | Member codes, private desk, notes, reading progress, suspension, and QR passes |
| `test_paper_plane_toggle.js` | Curator feature toggle and public portal parity |
| `test_functional_regressions.js` | Origin/CSRF protections, sensitive paths, validation, and rate limiting |

Some standalone files in `tests/` are retained from the older application and are not part of `npm test`; their endpoint expectations may describe services that are no longer mounted. The active route inventory is documented in [`server/routes/README.md`](../server/routes/README.md).
