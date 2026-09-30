# 📄 HTML Pages Manual (`/pages`)

This directory houses all HTML view entrypoints for **Wabi Sabi: A Reading Sanctuary**. Each page is crafted with semantic HTML5, accessible landmarks, and seamless integration with the sanctuary design system.

---

## 🧭 Page Architecture & User Journey

```
                        [pages/index.html]
                                │
                                ▼
                       [pages/login.html] ◄────────┐
                                │                  │
            ┌───────────────────┴──────────┐       │
            ▼                              ▼       │
   [pages/join.html]               (Sign in Success)
            │                              │
            ▼                              ▼
[pages/application-status.html]    [pages/home.html] (Sanctuary Dashboard)
                                           │
       ┌───────────────┬───────────────────┼───────────────────┬───────────────┐
       ▼               ▼                   ▼                   ▼               ▼
[pages/reader.html] [pages/table-room.html] [pages/community.html] [pages/wabi-wall.html] [pages/curator.html]
  (E-Book Reader)    (8-Seat Focus Room)    (Salon Forum)       (Memories Wall)    (Admin Desk)
```

---

## 📂 File Index & Technical Details

| File | Title & Description | Stylesheets | Client JavaScript | Target Audience & Guard |
| :--- | :--- | :--- | :--- | :--- |
| [`index.html`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/pages/index.html) | Root forwarder script | None | Inline redirect script | Public (Redirects to `login.html`) |
| [`login.html`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/pages/login.html) | Dual-panel editorial sign-in portal | `../css/tokens.css`<br>`../css/auth.css` | `../js/store.js`<br>`../js/auth.js` | Public visitors |
| [`join.html`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/pages/join.html) | 4-step membership admission questionnaire | `../css/tokens.css`<br>`../css/auth.css` | `../js/store.js`<br>`../js/onboarding.js` | Prospective applicants |
| [`application-status.html`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/pages/application-status.html) | Admissions review status & curator feedback | `../css/tokens.css`<br>`../css/auth.css` | `../js/store.js`<br>`../js/application.js` | Pending applicants |
| [`home.html`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/pages/home.html) | Member sanctuary homepage & reading stats | `../css/tokens.css`<br>`../css/dashboard.css` | `../js/store.js`<br>`../js/dashboard.js`<br>`../js/cat-engine.js` | Authenticated members (`requirePageAuth`) |
| [`reader.html`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/pages/reader.html) | Distraction-free e-book canvas & margin notes | `../css/tokens.css`<br>`../css/reader.css` | `../js/vendor/pdf.min.js`<br>`../js/store.js`<br>`../js/reader.js`<br>`../js/cat-engine.js` | Authenticated members (`requirePageAuth`) |
| [`table-room.html`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/pages/table-room.html) | 8-seat communal focus circle & real-time chat | `../css/tokens.css`<br>`../css/table-room.css` | `../js/store.js`<br>`../js/table-room.js`<br>`../js/cat-engine.js` | Authenticated members (`requirePageAuth`) |
| [`community.html`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/pages/community.html) | Salon discussion threads, polls, & replies | `../css/tokens.css`<br>`../css/community.css` | `../js/store.js`<br>`../js/community.js` | Authenticated members (`requirePageAuth`) |
| [`wabi-wall.html`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/pages/wabi-wall.html) | Theme weeks collective memory polaroid wall | `../css/tokens.css`<br>`../css/wabi-wall.css` | `../js/store.js`<br>`../js/wabi-wall.js` | Authenticated members (`requirePageAuth`) |
| [`curator.html`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/pages/curator.html) | Administrative review desk & book catalogue CMS | `../css/tokens.css`<br>`../css/curator.css` | `../js/store.js`<br>`../js/curator.js` | Curators only (`requireCuratorPage`) |
| [`theme-weeks.html`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/pages/theme-weeks.html) | Legacy redirect forwarder | `../css/tokens.css` | Inline redirect to `wabi-wall.html` | Backward compatibility |

---

## 🛡️ Page Guard Rules
1. **Server Verification**: Handled in [`server/middleware/auth.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/server/middleware/auth.js). If `wabisabi_session` cookie is absent or invalid, requests to private pages are redirected to `/login.html?redirect=<path>`.
2. **Client Instant Verification**: Every private page includes:
   ```html
   <script src="../js/store.js"></script>
   <script>
       if (window.WabiStore && typeof window.WabiStore.guardPage === 'function') {
           window.WabiStore.guardPage();
       }
   </script>
   ```
   This prevents any Flash of Unauthenticated Content (FOUC) while the DOM loads.
