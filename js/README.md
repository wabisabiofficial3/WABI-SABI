# ⚡ Client JavaScript Manual (`/js`)

This directory contains the front-end application logic for **Wabi Sabi: A Reading Sanctuary**. All scripts are written in standard ES6+ JavaScript, designed with modular separation of concerns, zero bloated framework runtimes, and clean connection to backend REST endpoints.

---

## 🧭 Client State & Data Architecture

```
                 [window.WabiStore] (store.js)
                 ├── Session state & JWT handling
                 ├── Theme engine (dark/light)
                 ├── HTTP Request Client (fetchWithAuth)
                 └── Client-side Page Guard Verification
                                 │
     ┌──────────────┬────────────┼─────────────┬──────────────┐
     ▼              ▼            ▼             ▼              ▼
dashboard.js    reader.js   table-room.js  community.js  curator.js
 (home.html)  (reader.html) (table-room)   (community)   (curator)
```

---

## 📂 File Index & Technical Responsibilities

| File | Purpose | Key Dependencies | Backend API Endpoints Called | Page Loaded On |
| :--- | :--- | :--- | :--- | :--- |
| [`store.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/store.js) | Central client store, authentication session manager, theme switcher, and API wrapper | None (Native Browser API) | `/api/auth/me`, `/api/auth/logout` | **All Pages** |
| [`auth.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/auth.js) | Login form submission, password toggling, demo login shortcuts, error handling | `store.js` | `/api/auth/login` | `login.html` |
| [`onboarding.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/onboarding.js) | Multi-step membership questionnaire, input validation, application submission | `store.js` | `/api/application/submit` | `join.html` |
| [`application.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/application.js) | Application status polling, review timeline display, decision notices | `store.js` | `/api/application/status/:id` | `application-status.html` |
| [`dashboard.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/dashboard.js) | Member homepage controller, reading progress stats, notices board carousel | `store.js` | `/api/notices`, `/api/content/current-book` | `home.html` |
| [`reader.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/reader.js) | E-reader canvas controller, PDF page rendering, bookmarks, margin notes dock | `store.js`, `vendor/pdf.min.js` | `/api/content/books/:id`, `/api/content/notes` | `reader.html` |
| [`table-room.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/table-room.js) | 8-seat communal focus room, active seating management, live chat polling, Pomodoro timer | `store.js` | `/api/chat/messages`, `/api/chat/presence` | `table-room.html` |
| [`community.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/community.js) | Salon forum board, category filtering, thread creation, comment trees, likes | `store.js` | `/api/community/threads`, `/api/community/comments` | `community.html` |
| [`wabi-wall.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/wabi-wall.js) | Theme weeks showcase, masonry polaroid wall, quote clippings, card submission | `store.js` | `/api/content/wall`, `/api/content/wall/submit` | `wabi-wall.html` |
| [`curator.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/curator.js) | Editorial desk, application approval/rejection queue, book catalogue CMS, notice composer | `store.js` | `/api/curator/*`, `/api/content/books`, `/api/notices` | `curator.html` |
| [`cat-engine.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/cat-engine.js) | Interactive sanctuary cat mascot engine ("Mochi") with audio purrs and walking animation | `assets/cat_*.png`, `assets/meow.mp3` | None | `home.html`, `reader.html`, `table-room.html` |
| [`admin-shortcut.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/admin-shortcut.js) | Hidden curator entrance: five deliberate clicks on the brand logo navigates to `/sanctuary` | None (Native DOM & sessionStorage) | `/sanctuary` navigation only | `home.html`, `community.html`, `table-room.html`, `wabi-wall.html`, `login.html`, `sanctuary.html` |
| [`theme-weeks.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/theme-weeks.js) | *Legacy script*: Automatically redirects legacy URL calls to `wabi-wall.js` | `store.js` | Redirects to `/wabi-wall.html` | `theme-weeks.html` |
| [`vendor/`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/vendor) | Third-party vendor libraries (Mozilla PDF.js) | See subfolder README | Local PDF rendering engine | `reader.html` |

---

## 🔒 Client-Side Route Guards

Every private member page (`home.html`, `reader.html`, `table-room.html`, `community.html`, `wabi-wall.html`, `curator.html`) invokes `WabiStore.guardPage()` inside an inline `<script>` tag at the very top of `<head>` or at DOM load:

1. **Member Authentication Guard**:
   If no valid session cookie/token exists, the client is immediately redirected to `/login.html?redirect=<current_path>`.
2. **Curator Role Guard**:
   `curator.html` additionally checks `user.role === 'curator'`. If a standard member attempts direct URL entry, they are redirected back to `/home.html` with an access alert.
