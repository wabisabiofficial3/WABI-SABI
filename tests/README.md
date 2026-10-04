# 🧪 Test Automation & Quality Assurance Manual (`/tests`)

This directory contains the automated test suites, security guard verification scripts, and link/asset crawlers for **Wabi Sabi: A Reading Sanctuary**.

---

## 🚀 Running the Test Suites

All tests can be executed with a single command from the project root:

```bash
npm test
```

Or executed directly:
```bash
node tests/run_all_tests.js
```

---

## 📂 Test Suites Catalog & Coverage

| Test File | Focus Area | What It Validates | Target Components / Endpoints |
| :--- | :--- | :--- | :--- |
| [`run_all_tests.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/run_all_tests.js) | **Master Orchestrator** | Executes all test suites sequentially, collects exit codes, and prints a final pass/fail scorecard. | Master Suite |
| [`test_auth_system.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/test_auth_system.js) | **Authentication & Security** | Validates password hashing, JWT session cookies, login credential validation, role permissions (`curator`, `member`, `applicant`), and logout clearing. | `/api/auth/*`, `server/db.js`, `server/routes/auth.js` |
| [`test_page_guards.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/test_page_guards.js) | **Server Route Guards** | Verifies `requirePageAuth` and `requireCuratorPage` middlewares redirect unauthorized visitors to `/login.html` and block non-curators from `/curator.html`. | `server/middleware/auth.js`, Protected HTML routes |
| [`test_client_guards.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/test_client_guards.js) | **Client-Side Guards** | Inspects DOM headers of private HTML files to ensure `WabiStore.guardPage()` is present before body render to eliminate unauthorized content flash. | `home.html`, `reader.html`, `table-room.html`, `community.html`, `wabi-wall.html`, `curator.html` |
| [`test_chat_persistence.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/test_chat_persistence.js) | **Communal Table Chat** | Tests SQLite message creation, sender user attribution, room filtering, polling queries, and chronological sorting. | `/api/chat/messages`, `data/wabisabi.db` |
| [`test_community_persistence.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/test_community_persistence.js) | **Salon Community Forum** | Tests thread authoring, category tags, comment replies, and atomic like count increments. | `/api/community/*`, `server/routes/community.js` |
| [`test_content_cms.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/test_content_cms.js) | **Content & Notices CMS** | Validates book catalogue retrieval, active notices board, and curator notice publishing. | `/api/content/*`, `/api/notices/*`, `server/routes/notices.js` |
| [`test_reader_widgets.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/test_reader_widgets.js) | **E-Reader UI Integrity** | Checks presence of `#pdfCanvas`, page steppers, bookmark controls, notes drawer, and sound player elements. | `reader.html`, `js/reader.js` |
| [`test_hero_ctas.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/test_hero_ctas.js) | **Navigation CTAs** | Ensures all Call-To-Action buttons across entry pages link to live and valid destinations with zero dead hrefs. | `home.html`, `login.html`, `join.html` |
| [`test_design_tokens_and_a11y.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/test_design_tokens_and_a11y.js) | **Design System & A11y** | Validates CSS tokens (`--bg-paper`, `--text-ink`, `--accent-clay`), ARIA attributes, semantic landmarks, and image `alt` texts. | `css/tokens.css`, All HTML files |
| [`check_links.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/check_links.js) | **Hyperlink Integrity** | Scans every anchor tag (`<a href>`) across all HTML files to confirm 100% of internal links point to existing files or routes. | All HTML files |
| [`check_assets.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/check_assets.js) | **Asset Audit** | Validates that every image (`src`), stylesheet (`href`), and script (`src`) referenced in HTML/CSS exists on the local filesystem. | `assets/`, `css/`, `js/` |
| [`test_wabi_wall.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/test_wabi_wall.js) | **Theme Wall API** | Tests wall post submissions, quote card rendering, and like reactions. | `/api/content/wall`, `server/routes/content.js` |
| [`test_admin_logo_shortcut.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/test_admin_logo_shortcut.js) | **Admin Logo 5-Tap Shortcut** | Verifies five deliberate clicks on the brand logo open `/sanctuary` while 1-4 clicks and modifier keys maintain normal navigation. | `js/admin-shortcut.js`, `.brand-logo` pages |
| [`audit_suite.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/tests/audit_suite.js) | **Unified System Audit** | Executes an all-in-one verification report for rapid continuous integration checks. | All subsystems |

---

## 🛡️ Adding New Tests
When adding new functionality or pages:
1. Create your test file in `tests/test_<feature>.js`.
2. Follow the standard exit-code convention (`process.exit(0)` on pass, `process.exit(1)` on failure).
3. Register the test in `tests/run_all_tests.js`.
