# 🖼️ Static Media & Brand Assets Manual (`/assets`)

This directory houses all static media assets, brand typography logos, book cover art, member avatars, sanctuary photography, companion cat sprites, and sound effects for **Wabi Sabi: A Reading Sanctuary**.

---

## 📂 Asset Catalog by Category

### 1. 🏷️ Brand Identity & Emblems
High-resolution dual-palette logos designed to seamlessly blend with both Washi Light and Charcoal Dark themes.

| Asset | Description | Usage / Connected Files |
| :--- | :--- | :--- |
| `wabi_sabi_emblem.png` | Circular calligraphy enso emblem (Dark ink for light theme) | Navbars, headers, favicon fallbacks |
| `wabi_sabi_emblem_dark.png` | Circular calligraphy enso emblem (Ivory ink for dark theme) | Navbars when `html.dark` is active |
| `wabi_sabi_horizontal.png` | Full wordmark logo with enso seal (Horizontal orientation) | Editorial headers, splash hero |
| `wabi_sabi_horizontal_dark.png` | Full wordmark logo with enso seal (Dark theme variant) | Splash hero in dark mode |
| `wabi_sabi_stacked.png` | Centered stacked brand logo | `login.html`, `join.html`, editorial modals |
| `wabi_sabi_stacked_dark.png` | Centered stacked brand logo (Dark theme variant) | `login.html`, `join.html` in dark mode |
| `enso_gold_transparent.png` | Transparent kintsugi gold brushwork ring | Accent overlays, welcome hero badge |

### 2. 📱 Favicons & Web Manifest
Standard multi-resolution icons adhering to modern PWA and browser standards. Referenced in `site.webmanifest` and all HTML `<head>` tags.
- `favicon.ico`, `favicon.png`, `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`
- `apple-touch-icon.png` (iOS home screen icon)
- `android-chrome-192x192.png`, `android-chrome-512x512.png` (PWA application launch icons)

### 3. 📖 Curated Literature Covers
High-fidelity book jacket photography used across the catalogue CMS, reading carousels, and reader selector.
- `atomic_habits_cover.jpg`: *Atomic Habits* by James Clear (`home.html`, `curator.html`)
- `catcher_in_the_rye.jpg`: *The Catcher in the Rye* by J.D. Salinger (`home.html`, `curator.html`)
- `cinema_of_solitude.jpg`: *Cinema of Solitude* literary edition (`home.html`, `curator.html`)

### 4. 🌿 Sanctuary Still Life & Textures
Atmospheric photographic backdrops reflecting Japanese wabi-sabi minimalism, rough linen, weathered stone, and botanical tranquility.
- `auth_still_life.jpg`: Warm literary still life featuring books, ceramics, and soft morning light on `login.html` and `join.html`.
- `book_stack_corner.jpg`: Macro photography of bound cloth books used on `home.html` reading cards.
- `botanical_branch.jpg`, `botanical_rock.jpg`: Organic zen elements for section dividers.
- `potted_plant_books.jpg`: Quiet sanctuary corner photography for empty states and quote cards.
- `space_creative_vinyl.jpg`, `space_deep_ivy.jpg`, `space_film_sunset.jpg`, `space_quiet_readers.jpg`: Ambient room themes selectable inside `table-room.html`.

### 5. 👥 Member Avatars
Profile imagery representing members seated in the communal table room and posting in community forums.
- `user_avatar.jpg`: Default active member profile avatar (`home.html`, top navigation bar).
- `avatar_aarav.jpg`, `avatar_aishwarya.jpg`, `avatar_ishita.jpg`, `avatar_meera.jpg`: Co-readers present at the table room (`table-room.html`) and authors of community discussions (`community.html`).

### 6. 🐾 Companion Cat ("Mochi") & Audio
Tactile companion engine assets controlled by [`js/cat-engine.js`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/js/cat-engine.js).
- `cat_sit.png`: Sitting tranquil pose.
- `cat_walk1.png`, `cat_walk2.png`: 2-frame walking animation loop across viewport bottom.
- `cat_look.png`: Curious glance upward toward cursor.
- `cat_sleep.png`: Curled asleep pose during prolonged idle reading.
- `meow.mp3`, `meow.wav`: Soft audio purr and chime triggered on clicking the companion cat.

### 7. 📚 Literature Subfolder
- [`books/`](file:///c:/Users/dhanu/OneDrive/Documents/WABI%20SABI/Wabi%20Sabi/assets/books): Contains full-text PDF and JSON chapters for offline reading. See `assets/books/README.md`.
