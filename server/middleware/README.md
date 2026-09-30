# 🛡️ Wabi Sabi — Middleware Architecture Manual (`server/middleware/`)

This directory contains the request interceptors and security access guards for both REST API endpoints and Express HTML page routes.

---

## 📂 File Inventory

```
server/middleware/
└── auth.js       # Centralized session verification, API guards, and HTTP 302 Page Guards
```

---

## 🔒 Security Functions Reference (`server/middleware/auth.js`)

### 1. `requireAuth(req, res, next)` — API Member Guard
- **Target:** REST API endpoints under `/api/*` that require an active member session (e.g. `POST /api/chat/messages`, `POST /api/community/poll/vote`, `POST /api/community/thoughts`).
- **Behavior:**
  1. Inspects the incoming `req.cookies.wabisabi_session`.
  2. If missing, responds immediately with **401 Unauthorized**:
     ```json
     { "success": false, "error": "Authentication required. Please sign in." }
     ```
  3. Computes the SHA-256 hash of the token and queries the `sessions` table joined with `users`.
  4. If expired or not found, responds with **401 Unauthorized**.
  5. If valid, attaches the authenticated user profile to `req.user` and calls `next()`.

---

### 2. `requireCurator(req, res, next)` — API Curator RBAC Guard
- **Target:** Sensitive administrative endpoints (e.g. `PUT /api/content/:section`, `PUT /api/curator/applications/:id/status`, `POST /api/notices`).
- **Behavior:**
  1. Runs the same session validation as `requireAuth`.
  2. Checks: `if (req.user.role !== 'CURATOR')`
  3. If not a curator, responds with **403 Forbidden**:
     ```json
     { "success": false, "error": "Curator privileges required." }
     ```
  4. If the user possesses the `CURATOR` role, allows execution to proceed to the route handler.

---

### 3. `requirePageAuth(req, res, next)` — HTTP 302 Page Redirect Guard
- **Target:** Express page routes serving member HTML files (`/home`, `/community`, `/reader`, `/table-room`, `/wabi-wall`, and direct `.html` file requests).
- **Behavior:**
  1. Inspects `req.cookies.wabisabi_session`.
  2. If missing or invalid, catches the unauthorized user at the network layer and issues an **HTTP 302 Redirect**:
     ```http
     HTTP/1.1 302 Found
     Location: /login?redirect=/table-room
     ```
  3. Prevents unauthenticated users from ever seeing the protected page markup or downloading member-only DOM trees.
  4. If authenticated, attaches `req.user` and calls `next()` to send the static HTML file.

---

### 4. `requireCuratorPage(req, res, next)` — HTTP 302 Curator Studio Guard
- **Target:** Curator Studio page routes (`/curator` and `/curator.html`).
- **Behavior:**
  1. If unauthenticated, redirects with **HTTP 302 to `/login?redirect=/curator`**.
  2. If logged in as a normal member (`role === 'USER'`), prevents access and redirects with **HTTP 302 to `/home`**.
  3. If logged in with `role === 'CURATOR'`, renders and serves `curator.html`.
