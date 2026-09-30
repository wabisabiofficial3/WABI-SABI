# 🎨 CSS Architecture Manual (`/css`)

This directory houses the presentation layer of **Wabi Sabi: A Reading Sanctuary**. The stylesheets are built on vanilla CSS with a custom-engineered design system that prioritizes literary elegance, tactile warmth, and distraction-free legibility.

---

## 📐 Design Philosophy & Token Flow

All styling cascades from `tokens.css`. No page or component uses hardcoded hex colors or arbitrary spacing values.

```
tokens.css (Design System Foundation)
  ├── 1. Color Palette: Japanese Paper & Wabi-Sabi earth tones
  ├── 2. Typography: Playfair Display, Cormorant Garamond, Inter
  ├── 3. Spacing & Elevation: 4px baseline grid, soft ambient shadows
  └── 4. Theme Modes: Light (Washi Paper) & Dark (Charcoal Slate via `html.dark`)
```

---

## 📂 File Index & Technical Responsibilities

| File | Purpose | Imports / Depends On | Applied On HTML Page |
| :--- | :--- | :--- | :--- |
| [`tokens.css`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/css/tokens.css) | Core design system tokens (colors, fonts, radii, shadows, dark theme overrides) | None | **All HTML Pages** |
| [`auth.css`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/css/auth.css) | Editorial split-screen layouts, forms, and application status badges | `tokens.css` | `login.html`, `join.html`, `application-status.html` |
| [`dashboard.css`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/css/dashboard.css) | Member dashboard, notices carousel, progress trackers, and quick actions | `tokens.css` | `home.html` |
| [`reader.css`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/css/reader.css) | Distraction-free reader canvas, PDF viewer, typography controls, and notes dock | `tokens.css` | `reader.html` |
| [`table-room.css`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/css/table-room.css) | Communal round table seating, avatar badges, live chat stream, and focus timers | `tokens.css` | `table-room.html` |
| [`community.css`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/css/community.css) | Salon forum boards, thread cards, reply trees, and tag filters | `tokens.css` | `community.html` |
| [`wabi-wall.css`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/css/wabi-wall.css) | Masonry grid, polaroid gallery cards, quote clippings, and submission modal | `tokens.css` | `wabi-wall.html` |
| [`curator.css`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/css/curator.css) | Administrative desk, review queue cards, book manager CMS, notice editor | `tokens.css` | `curator.html` |
| [`theme-weeks.css`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/css/theme-weeks.css) | *Legacy stylesheet*: Preserved for backward-compatibility with cached clients | `tokens.css` | `theme-weeks.html` (Redirect) |

---

## 🎨 Key Design Tokens Reference (`tokens.css`)

### Color Palette
- `--bg-paper`: `#f8f5f0` (Base light parchment tone)
- `--text-ink`: `#23201d` (Deep charcoal reading ink)
- `--accent-clay`: `#b35d38` (Terracotta bookbinder accent)
- `--accent-gold`: `#c59b27` (Wabi kintsugi highlight)
- `--surface-card`: `#ffffff` (Card background with subtle warmth)
- `--border-subtle`: `rgba(35, 32, 29, 0.08)` (Tactile borders)

### Typography
- `--font-serif-display`: `'Playfair Display', Georgia, serif`
- `--font-serif-body`: `'Cormorant Garamond', Garamond, serif`
- `--font-sans`: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`

### Dark Theme (`html.dark`)
Activated automatically via `html.dark` class toggled in [`js/store.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/store.js).
- `--bg-paper`: `#18181b` (Nocturne charcoal)
- `--text-ink`: `#e4e4e7` (Soft ivory ink)
- `--surface-card`: `#27272a` (Elevated slate card)
- `--border-subtle`: `rgba(255, 255, 255, 0.1)`

---

## 🔄 How Styles Connect to Logic

1. **Theme State**: Every page header includes a theme toggle button (`#themeToggleBtn`). When clicked, `store.js` writes `'dark'` or `'light'` to `localStorage` and sets the `class="dark"` attribute on `<html>`. The CSS rules in `tokens.css` immediately shift the entire site without page reload.
2. **Interactive States**: CSS handles hover elevations, card lifts (`transform: translateY(-2px)`), button active states, and modal overlay fades. Logic scripts add or remove state classes such as `.is-active`, `.modal-open`, and `.hidden`.
