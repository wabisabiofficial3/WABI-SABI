# 🛣️ Wabi Sabi — API Routes Architecture Manual (`server/routes/`)

This directory contains the modular Express routers that power all frontend REST interactions, authentication flows, community voting, and curator management.

---

## 📋 Route Inventory & Endpoints Reference

### 1. `auth.js` — Authentication & Member Session Management
- **Prefix:** `/api/auth`
- **Database Tables:** `users`, `sessions`
- **Endpoints:**
  - `POST /api/auth/login`
    - **Payload:** `{ "email": string, "password": string }`
    - **Logic:** Looks up active user in `users`, verifies password using Argon2id with stored salt. Generates a cryptographically random 32-byte session token, hashes it with SHA-256, and stores it in `sessions` table (expires in 7 days).
    - **Cookie:** Sets HTTP-only `wabisabi_session` cookie (`SameSite: Lax`, `Path: /`).
    - **Response:** `{ success: true, user: { id, email, displayName, handle, role, status } }`
  - `POST /api/auth/logout`
    - **Logic:** Deletes current session token hash from `sessions` table and clears `wabisabi_session` cookie.
    - **Response:** `{ success: true, message: "Logged out successfully" }`
  - `GET /api/auth/session`
    - **Logic:** Reads `wabisabi_session` cookie, verifies against unexpired records in `sessions`, joins profile in `users`.
    - **Response:** `{ success: true, user: { id, email, displayName, handle, role, status } }` (or 401 if unauthenticated)
- **Client Consumers:** [`js/auth.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/auth.js), [`js/store.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/store.js), [`js/dashboard.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/dashboard.js).

---

### 2. `chat.js` — Table Room Live Discussion Stream
- **Prefix:** `/api/chat`
- **Database Tables:** `table_room_messages`, `users`
- **Endpoints:**
  - `GET /api/chat/messages?week=4`
    - **Auth:** Public or Member (returns user info).
    - **Query Param:** `week` (integer 1–5, default `4`).
    - **Logic:** Queries `table_room_messages` joined with `users` for author name, avatar, and handle, ordered by `created_at ASC`.
    - **Response:** `{ success: true, week: 4, messages: [ { id, content, likesCount, createdAt, user: { id, displayName, handle, avatar } } ] }`
  - `POST /api/chat/messages`
    - **Auth:** Requires authenticated member (`requireAuth`).
    - **Payload:** `{ "content": string, "week": number }`
    - **Logic:** Validates message length (1–1000 characters). Inserts into `table_room_messages` with active user's ID.
    - **Response:** 201 Created `{ success: true, message: { ... } }`
  - `POST /api/chat/messages/:id/like`
    - **Auth:** Public / Member.
    - **Logic:** Executes atomic counter increment: `UPDATE table_room_messages SET likes_count = likes_count + 1 WHERE id = ?`.
    - **Response:** `{ success: true, likesCount: number }`
- **Client Consumers:** [`js/table-room.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/table-room.js) (Live chat feed, week filter, like buttons).

---

### 3. `community.js` — Perspectives Poll & Reader Thoughts Stream
- **Prefix:** `/api/community`
- **Database Tables:** `poll_votes`, `community_thoughts`, `users`
- **Endpoints:**
  - `GET /api/community/poll?pollId=week_04`
    - **Auth:** Optional session (returns whether current member has voted).
    - **Logic:** Aggregates vote totals per option (`option_0`, `option_1`, `option_2`), computes exact integer percentages, returns total votes and member's selected option.
    - **Response:** `{ success: true, pollId: "week_04", totalVotes: 48, options: { option_0: { count: 26, pct: 54 }, ... }, userVoted: true, userOption: 0 }`
  - `POST /api/community/poll/vote`
    - **Auth:** Requires authenticated member (`requireAuth`).
    - **Payload:** `{ "pollId": string, "optionIndex": number }`
    - **Logic:** Executes `INSERT INTO poll_votes (id, user_id, poll_id, option_chosen) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, poll_id) DO UPDATE SET option_chosen = excluded.option_chosen`. Members can change their vote, but cannot vote multiple times.
    - **Response:** `{ success: true, poll: { ...updated totals and percentages... } }`
  - `GET /api/community/thoughts`
    - **Logic:** Retrieves thoughts from `community_thoughts` joined with `users`, ordered by `created_at DESC`.
    - **Response:** `{ success: true, thoughts: [ { id, content, likesCount, createdAt, user: { displayName, handle, avatar } } ] }`
  - `POST /api/community/thoughts`
    - **Auth:** Requires authenticated member (`requireAuth`).
    - **Payload:** `{ "content": string }`
    - **Logic:** Inserts reflection into `community_thoughts`.
    - **Response:** 201 Created `{ success: true, thought: { ... } }`
  - `POST /api/community/thoughts/:id/like`
    - **Logic:** Executes atomic counter increment `UPDATE community_thoughts SET likes_count = likes_count + 1 WHERE id = ?`.
    - **Response:** `{ success: true, likesCount: number }`
- **Client Consumers:** [`js/community.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/community.js) (Interactive poll voting, live percentage animation, comment feed).

---

### 4. `content.js` — Curator Global Content CMS
- **Prefix:** `/api/content`
- **Database Tables:** `site_content`
- **Endpoints:**
  - `GET /api/content`
    - **Auth:** Public.
    - **Logic:** Reads all key/value JSON records from `site_content` (`featured_book`, `upcoming_event`, `sticky_titles`).
    - **Response:** `{ success: true, featuredBook: { ... }, upcomingEvent: { ... }, stickyTitles: { ... } }`
  - `PUT /api/content/:section`
    - **Auth:** Requires Curator role (`requireCurator`).
    - **Param:** `featured-book`, `upcoming-event`, or `sticky-titles`.
    - **Payload:** Updated JSON representation of the content section.
    - **Logic:** Executes `INSERT INTO site_content (section_key, json_data, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(section_key) DO UPDATE SET json_data = excluded.json_data, updated_at = excluded.updated_at`.
    - **Response:** `{ success: true, [section]: updatedData }`
- **Client Consumers:** [`js/curator.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/curator.js), [`js/store.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/store.js), [`js/dashboard.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/dashboard.js).

---

### 5. `application.js` — Membership Applications
- **Prefix:** `/api/application`
- **Database Tables:** `applications`, `users`
- **Endpoints:**
  - `POST /api/application/apply`
    - **Auth:** Public (for new applicants).
    - **Payload:** `{ "email": string, "displayName": string, "handle": string, "favoriteBook": string, "readingPhilosophy": string, "statement": string }`
    - **Logic:** Creates inactive user in `users` with `status: 'PENDING'` and inserts application in `applications`.
    - **Response:** 201 Created `{ success: true, applicationId: string }`
  - `GET /api/application/status`
    - **Auth:** Session cookie or applicant lookup.
    - **Response:** `{ success: true, user: { ... }, application: { status, curator_notes, ... } }`
- **Client Consumers:** [`js/onboarding.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/onboarding.js) (`join.html`), [`js/application.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/application.js) (`application-status.html`).

---

### 6. `curator.js` — Curator Studio Admin Actions
- **Prefix:** `/api/curator`
- **Access:** Strictly protected by `requireCurator` middleware.
- **Database Tables:** `applications`, `users`
- **Endpoints:**
  - `GET /api/curator/applications`
    - **Query Param:** `?status=PENDING` (optional filter).
    - **Logic:** Lists member applications joined with applicant email and handle.
  - `PUT /api/curator/applications/:id/status`
    - **Payload:** `{ "status": "ACTIVE" | "REJECTED", "notes": string }`
    - **Logic:** Updates application status and user status simultaneously in a SQLite transaction.
  - `GET /api/curator/stats`
    - **Logic:** Computes total members, pending applications, approved count, and active readers count.
- **Client Consumers:** [`js/curator.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/curator.js) (`curator.html`).

---

### 7. `notices.js` — Wabi Wall Digital Notice Board
- **Prefix:** `/api/notices`
- **Database Tables:** `notices`
- **Endpoints:**
  - `GET /api/notices`
    - **Logic:** Returns all active corkboard cards sorted by pinned priority and date.
  - `POST /api/notices`
    - **Auth:** Requires Curator role (`requireCurator`).
    - **Payload:** Notice card definition (title, subtitle, type, date, coordinates).
  - `PUT /api/notices/:id`
    - **Auth:** Requires Curator role (`requireCurator`).
    - **Logic:** Updates coordinates, text, or pin status.
  - `DELETE /api/notices/:id`
    - **Auth:** Requires Curator role (`requireCurator`).
- **Client Consumers:** [`js/wabi-wall.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/wabi-wall.js) (`wabi-wall.html`).
